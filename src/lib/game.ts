import { LIFIQueue } from './utilities.js';
import { log, warn } from './logger.js';
import type  { Socket } from 'socket.io'
import type { Server, DefaultEventsMap } from 'socket.io'
import { simplexPositive } from './simplex.js';

const playerEventKey: Record<string, number> = {
  "death by hunger": 0,
  "out of bounds": 1,
  "food warning": 2,
  "you got ate": 3,
  "nom": 4,
  "error": 255,
} 

const testingPositions = [1, 20, 32, 44, 55, 66]
let pullTestingPositions = [...testingPositions]

type ASocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>

function initializeGame(socketIo: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {

  let debugMode = false
  let maxEntityNumberReached = 1

  type Entity = number
  type Energy = number
  type Level = 1 | 2 | 3
  type Value = 0 | Level
  type Lifespan = number
  type Mineral = 0 | 1 | 2 | 3
  type Position = number

  const startingLifespanByLevel = [
    16, 32, 64 // measured in 100s of ms
  ]

  function splitUp64(num: number | undefined): (0 | 1 | 2 | 3) {
    if (!num) return 0
    // values should be 0-63 inclusive, a total of 64 values
    // So in this case, 0 for lifespan or for energy is synonymous with nonexistence, not the step before it
    if (num > 31) return 3
    if (num > 15) return 2
    return 1
  }

  function getMapConfig(){
    const rows = 64
    const cols = 64
    const viewRows = 4
    const viewCols = 4
    const views = viewRows * viewCols
    const tr = viewRows * rows
    const totalCols = viewCols * cols
    const totalRows = viewRows * cols
    const ppv = rows * cols // positions per view
    const positions = ppv * views
    return {rows, cols, viewRows, viewCols, views, totalCols, totalRows, tr, ppv, positions}
  }

  const map = getMapConfig()

  const cfg: Record<string, any> = {

    // Minerals
    mineralScale: 60,
    mineralSeed: Math.random() * 1000,
    mineralInversion: false,

    // organisms
    evolutionChance: 16, // 4-64 ish
    plantCycle: 8000, // 500 is really fun

    // Player
    energyDrainCycle: 500, // 4000,
    playerStartingEnergy: 15
  }

  // Currently it's possible to hop from left to right on the map
  const compass = [
    -map.tr - 1,
    -map.tr,
    -map.tr + 1,
    -1, 1,
    map.tr - 1,
    map.tr,
    map.tr + 1
  ]

  let entityCount: Entity = 1 // 0 is avoided since entity counter begins by adding 1 - this is good, since 0 can be fraught
  let recycledEntities: number[] = []

  const entities: Set<Entity> = new Set()

  function recycleEntity(entity: Entity){
    // if (recycledEntities.length > map.positions / 2) recycledEntities = [] // I don't think I should ever need this
    recycledEntities.push(entity)
  }

  // Normal Traits
  const energies: (Energy | undefined )[] = [] // energy and lifespans will actually end up being very similar values, interestingly: 0-63
  const levels: (Level | undefined )[] = []
  const lifespans: (Lifespan | undefined)[] = []

  // const positions: (Position | undefined)[] = []
  // this brainfucks me sometimes - the index here is the entity, which gets recycled
  // the value is the position. So if you know the entity, you can use it as an index to search for position
  const animalPositions: (Position | undefined)[] = []
  const plantPositions: (Position | undefined)[] = []

  const predators: Set<Entity> = new Set()
  const births: (number[] | undefined)[] = []

  // Reverse Trait Maps
  // Whereas in these, the index is actually the position on the map 
  const animalsByPosition: (Entity | undefined)[] = Array.from({length: map.positions})
  const plantsByPosition: (Entity | undefined)[] = Array.from({length: map.positions})

  const minerals: Mineral[] = Array.from({length: map.positions})

  for (let y = 0; y < map.totalRows; y++){
    for (let x = 0; x < map.totalCols; x++){
      let noise = Math.floor(+simplexPositive(x, y, cfg.mineralScale, cfg.mineralSeed) * 4) as Mineral
      let tileNumber = y * map.totalCols + x
      minerals[tileNumber] = noise
    }
  }

  // This is where all player connections get stored
  // and whenever a tile changes, all all players in that tile's view will be notified
  const viewRooms: Map<number, Set<string>> = new Map()
  const sockets: Map<Entity, ASocket> = new Map()
  // conflating this with active players may get confusing if a player dies but
  // I don't want to kill the connection so I can invite them to another game
  const entitiesBySocketId: Map<string, Entity> = new Map() // and this is so that I can get an entity from a socket, which I may not need because it should be in the scope

  for (let i = 0; i < 16; i++){
    viewRooms.set(i, new Set())
  }

  const randomVacancies = new LIFIQueue(map.positions);
  // const randomVacancies = new LIFIQueue(64); //  for testing, just use top

  function getEntityId(): number {
    try {
      if (recycledEntities.length > 0) return recycledEntities.pop()!
      entityCount++
      // entityCounterDebug++
      if (debugMode){
        maxEntityNumberReached = Math.max(entityCount, maxEntityNumberReached)
      }
      return entityCount
    } catch (e){
      throw new Error(`problem creating entityId: ${e}`)
    }
  }

  // ENTITY METHODS
  function createEntity(): Entity {
    try {
      const entity = getEntityId()
      entities.add(entity)
      // console.log(`created ${entity}`)
      // log(`created ${entity}`)
      return entity
    } catch (e){
      throw new Error(`problem creating entity: ${e}`)
    }
  }

  function valueAtPosition(position: Position): Value {

    const animalAtPosition = animalsByPosition[position]
    if (animalAtPosition) return getPlayerLevel(animalAtPosition)

    const plantAtPosition = plantsByPosition[position]
    if (plantAtPosition) return levels[plantAtPosition]!

    return 0
  }

  function removeEntityEntirely(entity: Entity){
    try {

      const position = plantPositions[entity] || animalPositions[entity]
        
      // simple traits
      energies[entity]  = undefined
      levels[entity]    = undefined
      lifespans[entity] = undefined
      births[entity]    = undefined

      // less simple traits
      removePosition(entity)

      predators.delete(entity)
      entities.delete(entity)

      recycleEntity(entity)

      sendUpdate(position!)

    } catch (e){
      const msg = `problem removing entity ${entity} entirely: ${e}`
      warn(msg)
      throw new Error(msg)
    }
  }

  // POSITION
  function getRandomPositionValue(): number {
    try {
      const nextPosition = randomVacancies.getNext()
      if (!nextPosition){
        warn(`looks like there is no more space for now!`)
        return -1
      }
      return nextPosition
    } catch (e){
      const msg = `${e}`
      warn(msg)
      throw new Error(msg)
    }
  }

  // Generic that can be used with plants or animals
  function addPosition(
    entity: Entity,
    position: Position,
    positions: (Position | undefined)[],
    entitiesByPosition: (Position | undefined)[]): void 
  {
    try {

      if (position < 0 || position > map.positions){
        throw new Error(`can't add position ${position}: out of bounds`)
      }
      
      entitiesByPosition[position] = entity
      positions[entity] = position

    } catch(e) {
      const msg = `failed to add position ${e}`
      warn(msg)
      throw new Error(msg)
    }
  }

  // Removes from both position and entitiesByPosition
  function removePosition(entity: Entity): void {

    const plantPosition = plantPositions[entity]
    if (plantPosition){
      plantPositions[entity]=undefined
      plantsByPosition[plantPosition]=undefined
    }

    const animalPosition = animalPositions[entity]   // Not planning on any entity existing in both animalPositions AND plantPositions
    if (animalPosition){                             // but better to check
      animalPositions[entity]=undefined              // not even totally clear what that would be
      animalsByPosition[animalPosition]=undefined    // maybe a swamp man or something
    }                                                // half man, half plant

    const anyPosition = plantPosition ?? animalPosition
    if (anyPosition){
      randomVacancies.reinsert(anyPosition)
    } else {
      warn(`entity ${entity} didn't HAVE a position to remove`)
    }
  }

  // SPATIAL ENTITY : ENTITY + POSITION
  // function spawnSpatialEntity(position: Position): Entity {
  //   try {
  //     // const newEntityPosition = position ? position : getRandomPositionValue()!
  //     // if (newEntityPosition === -1) return -1
  //     return createSpatialEntity(position)
  //   } catch (e){
  //     throw new Error(`Error while spawning entity createEntity(): ${e}`)
  //   }
  // }

  function createSpatialEntity(
    position: Position,
    positions: (Position | undefined)[],
    entitiesByPosition: (Entity | undefined)[]
  ): Entity {
    try {
      const entity = createEntity()
      addPosition(entity, position, positions, entitiesByPosition)
      return entity
    } catch (e){
      throw new Error(`Error while creating entity createEntity(): ${e}`)
    }
  }

  function getViewFromPosition(position: Position): number {
    // This could also be cached, but would it even be faster?

    // Global x, y (0-255, 0-255)
    const y = Math.floor(position / map.totalCols)
    const x = position % map.totalCols

    // then we deduce the view's x y (0-3, 0-3)
    const viewRow = Math.floor(y / map.rows)
    const viewCol = Math.floor(x / map.cols)

    return viewRow * map.viewCols + viewCol
  }

  function getViewAndLocalPositionFromPosition(position: Position): {view: number, localPosition: number} {

    // Global x, y (0-255, 0-255)
    const y = Math.floor(position / map.totalCols)
    const x = position % map.totalCols

    const viewRow = Math.floor(y / map.rows)
    const viewCol = Math.floor(x / map.cols)

    const localY = y - (viewRow * map.rows);
    const localX = x - (viewCol * map.cols);

    // Computation combined because they re-use a bunch of numbers
    return {
      view: viewRow * map.viewCols + viewCol,
      localPosition: localY * map.cols + localX
    }
  }

  function createPlayer(socket: ASocket): {player: Entity, position: Position} {
    log(`creating player for socket ${socket.id}`)
    // let position = 7712 // the middle for now, but will need to generate this randomly
    let position = getRandomPositionValue()
    // if (!pullTestingPositions.length) pullTestingPositions = [...testingPositions]
    // let position = testingPositions.pop()!
    let entity = createSpatialEntity(position, animalPositions, animalsByPosition)
    energies[entity] = cfg.playerStartingEnergy // come back to this
    sockets.set(entity, socket)
    entitiesBySocketId.set(socket.id, entity)
    // let viewIndex = getViewFromPosition(position)
    // viewRooms.get(viewIndex)!.add(socketId)
    sendEnergyUpdate(socket, cfg.playerStartingEnergy)
    return {player: entity, position}
  }

  function destroyPlayerMuahaha(player: Entity) {
    try {
      const position = animalPositions[player]
      let viewIndex = getViewFromPosition(position!)
      let socket = sockets.get(player)
      viewRooms.get(viewIndex)?.delete(socket?.id!)
      log(`removed player for socket ${socket?.id} (Muahaha)`)
      removeEntityEntirely(player)
    } catch(e){
      warn(`Problem removing player [${player}]: ${e}`)
    }

  }

  // Separating this from destroying player because they are really quite different,
  // even though they often happen at the same time
  function destroyConnectonMuahaha(socketId: string){
    const entityBySocket = entitiesBySocketId.get(socketId)
    if (entityBySocket) sockets.delete(entityBySocket!)
    entitiesBySocketId.delete(socketId)
    log(`destroyed connection ${socketId} (Muahaha)`)
  }

  // PLANTS
  function createPlant(level: Level, position: Position | undefined = undefined, ): void {
    // see docs for the difficulties of these patterns
    try {
      
      if (position && steadfastInhabitantsAtPosition(position, level)) return
      if (!position) return

      let entity = createSpatialEntity(position, plantPositions, plantsByPosition)

      let childrenNumber = 2

      // If not at the top level, AND we get a random ~1/8 chance, mutate up to higher level but only have one offspring
      // if (level < 3 && Math.random() > .99){ // simpler, but less favorable distribution for gameplay
      const chanceOfMutationScaledToLevel = (1 - Math.pow(cfg.evolutionChance, -level-1))
      // The goal here is to make it less likely for 2 to become level 3 than for 1 to become 2
      if (level < 3 && Math.random() > chanceOfMutationScaledToLevel){
        level = level + 1
        childrenNumber = 1
      }

      // TODO: also a chance to "evolve" down a level

      // this can happen if there's no room - the -1 trickles up, and we fail to create a plant
      if (entity === -1) return
      levels[entity] = level
      const normalLifespan = startingLifespanByLevel[level]

      lifespans[entity] = normalLifespan
      
      const childBirthtimes: number[] = []
      for (let i = 0; i < childrenNumber; i++){
        // let birthTime = normalLifespan*.99-minerals[position]*14
        const minVal = cfg.mineralInversion ? 3-minerals[position] : minerals[position]
        let birthTime = normalLifespan*.99-minVal*level*16
        childBirthtimes.push(birthTime)
      }

      // later birthtime first so we can pop off the smaller one from the end
      childBirthtimes.sort((a, b)=>b-a)
      // Random lifespans determined here

      // Get representation of tile, pack it into a buffer, send it over to the right room for the v
      births[entity] = childBirthtimes

      sendUpdate(position)

    } catch (e){
      const msg = `Failed to createPlant @ ${position}: ${e}`
      warn(msg)
      throw new Error(msg)
    }
  }

  // function sendUpdate(position: Position, val: 0 | 1 | 2 | 3, isYou: boolean = false){
  function sendUpdate(
    position: Position,
    socket: ASocket | null = null){

    const { view, localPosition } = getViewAndLocalPositionFromPosition(position)
    const val = valueAtPosition(position)

    // Create a buffer that tells position and pigment of update
    // but does not indicate that it is an update of the current player
    const othersPackedValue = (localPosition << 4) | (val << 2 ) | 0
    const othersBuffer = Buffer.alloc(2); // 12 for location, 2 for pigment, 1 for isYou
    othersBuffer.writeUInt16BE(othersPackedValue, 0)

    if (!socket){
      socketIo.to(`v:${view}`).emit("t", othersBuffer) // send to all parties by room
    } else {
      // otherwise, create a buffer that indicates selfhood just for the party that moved
      // and send that to them, and the non-selfhood update to everyone else
      const selfPackedValue = (localPosition << 4) | (val << 2 ) | 1 << 1 // the 0 position is still remaining empty
      const selfBuffer = Buffer.alloc(2)
      selfBuffer.writeUInt16BE(selfPackedValue, 0)
      socket?.emit("t", selfBuffer)
      socket.to(`v:${view}`).emit("t", othersBuffer) // sends to everyone BESIDES socket (note it is socket.to and not socketIo.to)
    }
  }

  function decrementLifespan(entity: Entity): void {
    const lifespan = lifespans[entity]
    if (lifespan === undefined) return
    if (lifespan === 0 ){
      removeEntityEntirely(entity)
    } else {
      lifespans[entity] = lifespan! - 1
    }
  }

  function getNeighborPositions(position: Position): Position[] {
    const potentialNeighbors = []
    for (const dir of compass){
      const potentialNeighbor = position + dir
      if (potentialNeighbor >= 0 && potentialNeighbor < map.positions){
        if (!inhabitantsAtPosition(potentialNeighbor)){
          potentialNeighbors.push(potentialNeighbor)
        }
      }
    }
    // console.log("starting position", position)
    // console.log(potentialNeighbors)
    return potentialNeighbors
  }

  function inhabitantsAtPosition(position: Position): boolean {
    for (let positions of [plantsByPosition, animalsByPosition]){
      if (positions[position]) return true
    }
    return false
  }

  function steadfastInhabitantsAtPosition(position: Position, relativeLevel: number): boolean {
    // For now, if there is any animal, just return false - plants can't reproduce on top of animals
    if (animalPositions[position]) return true

    const plant = plantsByPosition[position]

    // If there is a plant with a higher or the same level, also return that
    if (plant && levels[plant] && levels[plant] >= relativeLevel) return true
    
    // Otherwise, inhabitants at position are stronger
    return false
  }

  function specificAnimalCanMoveToPosition(position: Position, animal: Entity): boolean {
    // const e = energies[animal]!
    const animalLevel = getPlayerLevel(animal)
    const plant = plantsByPosition[position]
    const foreignAnimal = animalsByPosition[position]

    if (plant){
      const plantLevel = levels[plant]
      if (animalLevel < plantLevel!) return false
    }

    if (foreignAnimal){
      // check if foreign animal is predator, or if current animal is predator. But for now...
      return false
    }

    return true
  }

  function plantReproduce(entity: Entity): void {

    if (typeof lifespans[entity] !== "number") warn(`${entity} is not a plant, and we can't get seed positions for it`)

    const position = plantPositions[entity]
    if (!position) throw new Error(`plantReproduce failed to get parent location ${entity}`)

    const level = levels[entity]!
    const lifespan = startingLifespanByLevel[level]
    if (!lifespan) throw new Error(`plantReproduce failed to get level of parent`)

    const seedPositions: Position[] = []
    const neighborPositions = getNeighborPositions(position)
    for (const neighboringPosition of neighborPositions){
      // if (lifespanAtPosition(neighboringPosition) / 3 >= lifespan) continue
      if (inhabitantsAtPosition(neighboringPosition)) continue
      seedPositions.push(neighboringPosition)
    }

    if (!seedPositions.length) return

    const randomSeedPosition = seedPositions[Math.floor(Math.random() * seedPositions.length)]
    createPlant(level, randomSeedPosition)
  }

  const commandKey = [-map.totalCols, map.totalCols, -1, 1]

  function incrementPlayerEnergy(player: Entity): number {
    let currentEnergy = energies[player]
    if (currentEnergy && currentEnergy < 63){
      energies[player]! += 1
      return energies[player]!
    }
    return 0
  }

  function decrementPlayerEnergy(player: Entity): number {
    let currentEnergy = energies[player]
    if (currentEnergy && currentEnergy > 0){
      energies[player]! -= 1
      return energies[player]!
    } else {
      throw new Error("player energy was already at 0 and an attempt was made to decrement it")
    }
  }

  function playerEat(
    socket: ASocket,
    player: Entity
  )
  {

    // TODO: oh make sure that when eating they are getting the right amount of juice
    // As in, if they eat a higher level plant, they should get more yums
    const playerPosition = animalPositions[player]!
    const plant = plantsByPosition[playerPosition]
    if (plant){
      removeEntityEntirely(plant)
      const newEnergy = incrementPlayerEnergy(player)
      if (newEnergy){
        sendUpdate(playerPosition, socket)
        sendEnergyUpdate(socket, newEnergy)
      }
      // TODO
      // sendUpdate() // have to send the players pigment representation otherwise it's just the plant overwrite update that gets sent
      // Or we could check and see like, if a plant dies, maybe actually send the update to account for maybe a player is there
    }    
  }

  function playerMove(
    socket: ASocket,
    player: Entity,
    command: number): boolean
  {
    const oldPosition = animalPositions[player]
    if (typeof oldPosition !== 'number') return false
    const newPosition = oldPosition + commandKey[command]
    if (newPosition > map.positions || newPosition < 0) return false
    if (oldPosition % map.totalCols === 0 && command === 2) return false // going left: prevent from hooking back around to the right (plus up one)
    if (oldPosition % map.totalCols === map.totalCols-1 && command === 3) return false // going right: prevent from hooking back around the left (plus down one)
    if (!specificAnimalCanMoveToPosition(newPosition, player)) return false

    // otherwise, we're good! Just move!
    animalPositions[player] = newPosition
    animalsByPosition[oldPosition] = undefined
    animalsByPosition[newPosition] = player

    const oldView = getViewFromPosition(oldPosition)
    const newView = getViewFromPosition(newPosition)

    // this check could be optimized to not do such accurate checks every move
    if (oldView !== newView){
      socket.leave(`v:${oldView}`)
      socket.join(`v:${newView}`)
      socket.emit("view", getViewAsBuffer(newPosition))
    } else {
      // Send updated representation of new position player inhabits now
      sendUpdate(newPosition, socket)
      // Send updated representation of the position they left behind
      sendUpdate(oldPosition)
    }

    return true
  }

  function getPlayerLevel(player: Entity): 0 | 1 | 2 | 3 {
    const rawLevel = Math.floor(energies[player]! / 16) + 1;
    return Math.max(0, Math.min(3, rawLevel)) as 0 | 1 | 2 | 3;
  }

  function handlePlantLifecycles(): void {
    // console.time("st")

    if (debugMode){
      console.log(
        `
        Highest entity #: ${maxEntityNumberReached},
        # of entities   : ${entityCount},
        Ready to Recycle: ${recycledEntities.length}
        `
      )
    }

    for (let entity = 0; entity < lifespans.length; entity++){

      const lifespan = lifespans[entity]
      if (lifespan === undefined) continue

      const birthTimes = births[entity]

      if (Array.isArray(birthTimes)){

        if (birthTimes.length === 0){
          births[entity] = undefined
          continue
        }

        if (birthTimes[birthTimes.length - 1] >= lifespan){
          birthTimes.pop()
          plantReproduce(entity)
        }
      }

      decrementLifespan(entity)
    }
    // console.timeEnd("st")
  }

  function sendEnergyUpdate(socket: ASocket, energy: Energy){
    /*
    informative energy event messages
    - you were eaten
    - you died of starvation
    - you ate something (and gained energy)
    - you lost energy
    */
    const buffer = Buffer.alloc(1)
    buffer.writeUInt8(energy, 0)
    socket.emit("e", buffer)
  }

  function sendPlayerEvent(socket: ASocket, eventName: string){
    const buffer = Buffer.alloc(2)
    const code = playerEventKey[eventName] ?? 255
    if (code === 255){
      warn("oh you can't be doin that")
    }
    buffer.writeUInt16BE(code, 0)
    socket.emit("playerEvent", buffer)
  }

  function handleEnergyDrainCycles(){
    // Iterate through all active sockets
    for (const [_, socket] of sockets){
      const player = entitiesBySocketId.get(socket.id)
      if (!player) throw new Error(`No player exists for socket ${socket.id}`)
      const position = animalPositions[player]
      if (!position){
        warn(`when decrementing players by socket, no position found for animal ${player}`)
        continue
      }

      const e = decrementPlayerEnergy(player)
      if (e === 0){
        // removeEntityEntirely(player)
        destroyPlayerMuahaha(player) // I think this is a better fit
        sendPlayerEvent(socket, "death by hunger")
        // socket.emit('playerEvent', )
        // TODO
         // I think this will update everyone so that the thing is dead?
        // But we also need to do whatever we do at the beginning
        // AND send a meta update of some kind to let them know they died of hunger. They should probably get sent to some page. And then
        // I guess they could just be navigated right back again, and start over.
      } else {
        sendUpdate(position, socket)
        // this is where we probably have to
        // find the socket that we've saved (and we'll have to save it if we haven't)
        // for that player, and send ONLY THEM a lil update about what's going down
        // I think we'll do someting similar if they die too -- we'll need their socket
      }
      sendEnergyUpdate(socket, e)

    }
  }

  // NETWORK ABSTRACTIONS

  // TODO: This should return a buffer representation of the view of the position given
  // There are 16 views
  // However, we should just keep the most up to date version of this saved in memory
  // and update it as things save
  // That way, incremental changes in global state change the global view representations once
  // and all this method will have to do is get the right view slice and serve it
  // but as it is, the view will have to be computed whenever a player moves, which is more expensive
  // in probably just about any case, even with just one player - it's also a lot of computation at once
  function getViewAsBuffer(position: number): Buffer {
    const viewSize = 4096; // 64x64 view
    const bitDepth = 2; // Each value needs 2 bits
    const bytesNeeded = viewSize / (8 / bitDepth); // 1024 bytes
    const buffer = Buffer.alloc(bytesNeeded);
    
    const y = Math.floor(position / 256);
    const x = position % 256;
    const viewCol = Math.floor(x / 64); // View columns are 64 wide, not 4
    const viewRow = Math.floor(y / 64); // View rows are 64 high, not 4
    if (debugMode){
      console.log(`view coords are`, {y, x})
    }
    
    let tempArray: (0 | 1 | 2 | 3)[] = Array.from({length: viewSize}, () => 0);
    
    // Iterate through the current view's area
    for (let localRow = 0; localRow < 64; localRow++) {
      for (let localCol = 0; localCol < 64; localCol++) {
        // Calculate global position
        const globalRow = viewRow * 64 + localRow;
        const globalCol = viewCol * 64 + localCol;
        const globalPos = globalRow * 256 + globalCol;
        
        // Calculate local index in the tempArray (0-4095)
        const localIndex = localRow * 64 + localCol;

        const animalAtPosition = animalsByPosition[globalPos]
        const plantAtPosition = plantsByPosition[globalPos]

        if (animalAtPosition){
          const energy = energies[animalAtPosition]
          tempArray[localIndex] = splitUp64(energy)
        }

        if (plantAtPosition){
          const lifespan = lifespans[plantAtPosition];
          tempArray[localIndex] = levels[plantAtPosition]!
        }
      }
    }
    
    // Pack the values into the buffer in a logical left-to-right order
    for (let i = 0; i < 1024; i++) {
      const v1 = tempArray[i * 4] & 0b11;     // First value (leftmost)
      const v2 = tempArray[i * 4 + 1] & 0b11;  // Second value
      const v3 = tempArray[i * 4 + 2] & 0b11;  // Third value
      const v4 = tempArray[i * 4 + 3] & 0b11;  // Fourth value (rightmost)
      
      // Pack them with v1 in the lowest bits (makes unpacking more intuitive)
      buffer[i] = (v4 << 6) | (v3 << 4) | (v2 << 2) | v1;
    }
    
    return buffer;
  }

  // function printBytesInBinary(buff: Buffer){
  //   const binaryStrings = Array.from(buff)
  //     .map(byte => byte.toString(2).padStart(8, '0')); // pad to ensure 8-bit representation
  //   console.log(binaryStrings.join(' ')); // Print the binary representation of each byte
  // }
  return {
  entities,
    createPlant,
    getViewFromPosition,
    createPlayer,
    destroyPlayerMuahaha,
    destroyConnectonMuahaha,
    getViewAsBuffer,
    handlePlantLifecycles,
    handleEnergyDrainCycles,
    getRandomPositionValue,
    playerMove,
    playerEat,
    cfg,
  }
}

export default initializeGame


function printBufferAsBinary(buffer: any) {
  const binaryStrings = [];
  for (let i = 0; i < buffer.length; i++) {
    // Convert to binary and pad with leading zeros
    const binary = buffer[i].toString(2).padStart(8, '0');
    binaryStrings.push(binary);
  }
  return binaryStrings.join(' ')
}