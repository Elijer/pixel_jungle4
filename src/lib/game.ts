import { LIFIQueue } from './utilities.js';
import { log, warn } from './logger.js';
import type { Server, DefaultEventsMap } from 'socket.io'

function initializeGame(socketIo: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {

  let debugMode = false
  let entityCounter = 0
  let maxEntityNumberReached = 1

  type Entity = number
  type Energy = number
  type Level = 0 | 1 | 2
  type Lifespan = number
  type Position = number

  const lifespanArchetypes = [
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
    const ppv = rows * cols // positions per view
    const positions = ppv * views
    return {rows, cols, viewRows, viewCols, views, totalCols, tr, ppv, positions}
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

  let entityCount: Entity = 0 // 0 is avoided since entity counter begins by adding 1 - this is good, since 0 can be fraught
  let recycledEntities: number[] = []

  const entities: Set<Entity> = new Set()

  function recycleEntity(entity: Entity){
    // if (recycledEntities.length > map.positions / 2) recycledEntities = [] // I don't think I should every need this
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
  const entitiesBySocket: Map<string, Entity> = new Map() // and this is so that I can get an entity from a socket, which I may not need because it should be in the scope

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
      entityCounter++
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

      entityCounter--

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
      entitiesBySocket.delete(socket)
    }
  }

  function getViewFromPosition(position: Position): number {
    // This could also be cached, but would it even be faster?
    // The computation of these two values is combined because so far they are always fetched together
    // and they re-use a bunch of numbers

    // Global x, y (0-255, 0-255)
    const y = Math.floor(position / map.totalCols)
    const x = position % map.totalCols

    // then we deduce the view's x y (0-3, 0-3)
    const viewRow = Math.floor(y / map.rows)
    const viewCol = Math.floor(x / map.cols)

    // by subtracting the vaue of the first row or col in view, we get local x y
    // (0-63, 0-63)
    // we can also get the local x and y
    // const localY = y - (viewRow * map.rows);
    // const localX = x - (viewCol * map.cols);

    return viewRow * map.viewCols + viewCol
  }

  function createPlayer(socketId: string): {player: Entity, position: Position} {
    let position = 7712 // the middle for now, but will need to generate this randomly
    let entity = createSpatialEntity(position, animalPositions, animalsByPosition)
    energies[entity] = 33 // come back to this
    sockets.set(entity, socketId)
    entitiesBySocket.set(socketId, entity)
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
    try {
      
      // prevent possibility of multiple plants in the same place
      if (position && inhabitantsAtPosition(position)) return
      if (!position) return

      // let entity = spawnSpatialEntity(position)
      let entity = createSpatialEntity(position, plantPositions, plantsByPosition)

      // this can happen if there's no room - the -1 trickles up, and we fail to create a plant
      if (entity === -1) return
      levels[entity] = level
      const lifespan = lifespanArchetypes[level]
      lifespans[entity] = lifespan
      
      const childBirthtimes: number[] = []
      for (let i = 0; i < 2; i++){
        // Get a random timestamp within organism's lifespan
        // TODO: add minerals to influence this
        // The idea here is that I want variation in lifespans, but I don't want plants
        // having a chance to reproduce milliseconds after being born, that's weird
        childBirthtimes.push(Math.floor((lifespan/3) + Math.random() * lifespan / 3))
      }

      // later birthtime first so we can pop off the smaller one from the end
      childBirthtimes.sort((a, b)=>b-a)
      // Random lifespans determined here
      births[entity] = childBirthtimes

      const view = getViewFromPosition(position)
      socketIo.to(`v:${view}`).emit('update', {
        msg: `hi from plant ${entity}`
      })

    } catch (e){
      const msg = `Failed to createPlant @ ${position}: ${e}`
      warn(msg)
      throw new Error(msg)
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
    const lifespan = lifespanArchetypes[level]
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
          tempArray[localIndex] = splitUp64(lifespan)
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
    handlePlantLifecycles
  }
}

export default initializeGame