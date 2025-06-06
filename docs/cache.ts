import { LIFIQueue } from './utilities.js';
import { log, warn } from './logger.js';
import type  { Socket } from 'socket.io'
import type { Server, DefaultEventsMap } from 'socket.io'
import { simplexPositive } from './simplex.js';

function initializeGame(socketIo: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {

  let debugMode = false
  // let entityCounterDebug = 0
  let maxEntityNumberReached = 1

  type Entity = number
  type Energy = number
  type Level = 1 | 2 | 3
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

  // I think technically, at edges of maps when used, this will hop the map in a few cases
  // but maybe it's fine for now
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
  const sockets: Map<Entity, string> = new Map() // so this is so I can find a socket for entities in a view I guess?

  // Reverse Trait Maps
  // Whereas in these, the index is actually the position on the map 
  const animalsByPosition: (Entity | undefined)[] = Array.from({length: map.positions})
  const plantsByPosition: (Entity | undefined)[] = Array.from({length: map.positions})
  const entitiesBySocketId: Map<string, Entity> = new Map() // and this is so that I can get an entity from a socket, which I may not need because it should be in the scope

  const minerals: Mineral[] = Array.from({length: map.positions})

  for (let y = 0; y < map.totalRows; y++){
    for (let x = 0; x < map.totalCols; x++){
      let noise = Math.floor(+simplexPositive(x, y, 20, 12) * 4) as Mineral
      let tileNumber = y * map.totalCols + x
      minerals[tileNumber] = noise
    }
  }

  // This is where all player connections get stored
  // and whenever a tile changes, all all players in that tile's view will be notified
  const viewRooms: Map<number, Set<string>> = new Map()

  for (let i = 0; i < 16; i++){
    viewRooms.set(i, new Set())
  }

  const randomVacancies = new LIFIQueue(map.positions);

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

  function removeEntityEntirely(entity: Entity){
    try {

      const position = plantPositions[entity] || animalPositions[entity]
      sendUpdate(position!, 0)
        

      // simple traits
      energies[entity]  = undefined
      levels[entity]    = undefined
      lifespans[entity] = undefined
      births[entity]    = undefined

      // more entangled traits
      removePosition(entity)
      removeSocket(entity)

      predators.delete(entity)
      entities.delete(entity)

      recycleEntity(entity)
      // console.log(`removed ${entity} entirely`)
      // log(`removed ${entity} entirely`)

      // entityCounterDebug-- // debugging only

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

  // SOCKETS
  function addSocket(entity: Entity, socketId: string): void {
    sockets.set(entity, socketId)
  }

  function removeSocket(entity: Entity): void {
    if (sockets.has(entity)){
      const socket = sockets.get(entity)!
      sockets.delete(entity)
      entitiesBySocketIdId.delete(socket)
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

  function createPlayer(socketId: string): {player: Entity, position: Position} {
    // let position = 7712 // the middle for now, but will need to generate this randomly
    let position = getRandomPositionValue()
    let entity = createSpatialEntity(position, animalPositions, animalsByPosition)
    energies[entity] = 33 // come back to this
    sockets.set(entity, socketId)
    entitiesBySocketId.set(socketId, entity)
    // let viewIndex = getViewFromPosition(position)
    // viewRooms.get(viewIndex)!.add(socketId)
    return {player: entity, position}
  }

  function destroyPlayerMuahaha(player: Entity) {
    try {
      const position = animalPositions[player]
      let viewIndex = getViewFromPosition(position!)
      let socketId = sockets.get(player)
      viewRooms.get(viewIndex)?.delete(socketId!)
      removeEntityEntirely(player)
    } catch(e){
      warn(`Problem removing player [${player}]: ${e}`)
    }

  } 

  // PLANTS
  function createPlant(level: Level, position: Position | undefined = undefined, ): void {
    // So I think I keep making the same mistake -
    // I am using lifespan to calculate to many things.
    try {
      
      // prevent possibility of multiple plants in the same place
      if (position && inhabitantsAtPosition(position)) return
      if (!position) return

      // let entity = spawnSpatialEntity(position)
      let entity = createSpatialEntity(position, plantPositions, plantsByPosition)

      // this can happen if there's no room - the -1 trickles up, and we fail to create a plant
      if (entity === -1) return
      levels[entity] = level
      const normalLifespan = startingLifespanByLevel[level]
      // const actualLifespan = normalLifespan / (minerals[position]+1) // ah. This leads to weird behavior because
      // if I put the birthTimes towards the end, if I also reduce the lifespan, they can happen really fast
      // again, using lifespan...sort of a problem.
      const actualLifespan = normalLifespan
      lifespans[entity] = actualLifespan
      
      const childBirthtimes: number[] = []
      for (let i = 0; i < 2; i++){
        // let birthTime = Math.floor((normalLifespan/3) + (Math.random() * normalLifespan / 3))
        // let birthTime = Math.floor(normalLifespan - Math.random() * normalLifespan/2 + minerals[position] * normalLifespan/4)
        // let birthTime = normalLifespan - minerals[position] * normalLifespan * 1.2 * Math.random()
        const increment = normalLifespan / 4
        const minimumDelay = increment * 2
        let birthTime = normalLifespan - minimumDelay - (minerals[position] * increment) - (Math.random()*increment/2)
        // So I don't totally understand, but I am running into a problem because
        // there isn't REALLY an option for deadzones
        // let birthTime = Math.floor((lifespan/3) + Math.random() * lifespan / 3) + minerals
        // [position] * 8
        childBirthtimes.push(birthTime)
      }

      // later birthtime first so we can pop off the smaller one from the end
      childBirthtimes.sort((a, b)=>b-a)
      // Random lifespans determined here

      // Get representation of tile, pack it into a buffer, send it over to the right room for the v
      births[entity] = childBirthtimes

      sendUpdate(position, level)

    } catch (e){
      const msg = `Failed to createPlant @ ${position}: ${e}`
      warn(msg)
      throw new Error(msg)
    }
  }

  function sendUpdate(position: Position, val: 0 | 1 | 2 | 3){
    const { view, localPosition } = getViewAndLocalPositionFromPosition(position)
    // check

    const packedValue = (localPosition << 2) | val
    const buffer = Buffer.alloc(2); // 12 for location, 2 for pigment
    buffer.writeUInt16BE(packedValue, 0)
    socketIo.to(`v:${view}`).emit('u', buffer)
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

  // So at the MOMENT, since createPlant relies on this
  // plants just can't reproduce on top of a tile with ANYTHING in it
  // Which keeps things pretty simple
  // but also...means that players can't things yet
  function inhabitantsAtPosition(position: Position): boolean {
    for (let positions of [plantsByPosition, animalsByPosition]){
      if (positions[position]) return true
    }
    return false
  }

  // function lifespanAtPosition(position: Position): number {
  //   const inhabitants = entitiesByPosition[position]
  //   if (inhabitants){
  //     for (const inhabitant of inhabitants){
  //       if (typeof lifespans[inhabitant] === "number") return lifespans[inhabitant]
  //     }
  //   }
  //   return 0
  // }

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

  function movePlayer(
    socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    player: Entity,
    command: number): boolean
  {
    const playerPosition = animalPositions[player]
    if (typeof playerPosition !== 'number') return false
    const newPosition = playerPosition + commandKey[command]
    if (newPosition > map.positions || newPosition < 0) return false
    
    // In the future, I should make a complex ruling function that checks things like
    // is the current player a predator, is the target a plant, etc.
    // for now, just prevent a player from moving to any tile where there is something already there
    if (inhabitantsAtPosition(newPosition)) return false

    // otherwise, we're good! Just move!
      // change the state
    animalPositions[player] = newPosition
    animalsByPosition[playerPosition] = undefined
    animalsByPosition[newPosition] = player

    const oldView = getViewFromPosition(playerPosition)
    const newView = getViewFromPosition(newPosition)
    // this check could be optimized to not do such accurate checks every move
    if (oldView !== newView){
      socket.leave(`v:${oldView}`)
      socket.join(`v:${newView}`)
      socket.emit("view", getViewAsBuffer(newPosition))
    } else {
      // Send updated representation of new position player inhabits now
      sendUpdate(newPosition, 1)
      // Send updated representation of the position they left behind
      const plant = plantsByPosition[playerPosition]
      const plantLevel = plant ? levels[plant] || 0 : 0
      sendUpdate(playerPosition, plantLevel)
    }

    return true
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
    getViewAsBuffer,
    handlePlantLifecycles,
    getRandomPositionValue,
    movePlayer
  }
}

export default initializeGame