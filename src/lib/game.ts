import { LIFIQueue } from './utilities.js';
import { log, warn } from './logger.js';

type Entity = number
type Energy = number
type Level = 0 | 1 | 2
type Lifespan = number
type Position = number

const lifespanArchetypes = [
  16, 32, 64 // measured in 100s of ms
]

function splitUp64(num: number): (0 | 1 | 2 | 3) {
  // values should be 0-63 inclusive, a total of 64 values
  // So in this case, 0 for lifespan or for energy is synonymous with nonexistence, not the step before it
  if (num > 31) return 3
  if (num > 15) return 2
  if (num > 0) return 1
  return 0
}

function getMapConfig(){
  const rows = 64
  const cols = 64
  const viewRows = 4
  const viewCols = 4
  const totalRows = viewRows * rows
  const totalCols = viewCols * cols
  const views = 16
  const positionsPerView = rows * cols
  const positions = positionsPerView * views
  return {rows, cols, viewRows, viewCols, views, totalCols, totalRows, positionsPerView, positions}
}

const map = getMapConfig()

// I think technically, at edges of maps when used, this will hop the map in a few cases
// but maybe it's fine for now
const compass = [
  -257,
  // -map.totalCols,
  // -map.totalCols + 1,
  // -1,
  // 1,
  // map.totalCols - 1,
  // map.totalCols,
  // map.totalCols + 1,
]

// TODO: Maybe add a limit to the number of entities allowed?
let entityCount: Entity = 1 // starting at 1 avoids checking for 0, which can be fraught
let recycledEntities: number[] = []

const entities: Set<Entity> = new Set()

function recycleEntity(entity: Entity){
  // If the number of recycled entities has grown to a really big number
  // just purge them, we're not getting rid of them fast enough
  // honestly though, if this is the case, there are probably other issues of scale
  if (recycledEntities.length > map.positions / 2) recycledEntities = []
  recycledEntities.push(entity)
}

// Normal Traits
const energies: (Energy | undefined )[] = [] // energy and lifespans will actually end up being very similar values, interestingly: 0-63
const levels: (Level | undefined )[] = []
const lifespans: (Lifespan | undefined)[] = []
const positions: (Position | undefined)[] = []
const predators: Set<Entity> = new Set()
const births: (number[] | undefined)[] = []
const sockets: Map<Entity, string> = new Map()

// Reverse Trait Maps
const entitiesByPosition: (Set<Entity> | undefined)[] = []
const entitiesBySocket: Map<string, Entity> = new Map()

const randomVacancies = new LIFIQueue(map.positions);

function getEntityId(): number {
  try {
    if (recycledEntities.length > 0) return recycledEntities.pop()!
    return entityCount++
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

function addPosition(entity: Entity, position: Position, ): void {
  try {

    if (position < 0 || position > map.positions){
      throw new Error(`createSpatialEntity specified position outside of possible position range ${position}`)
    }

    if (!entitiesByPosition[position]){
      entitiesByPosition[position] = new Set()
    }
    
    entitiesByPosition[position].add(entity)
    positions[entity] = position
  } catch(e) {
    const msg = `failed to add position ${e}`
    warn(msg)
    throw new Error(msg)
  }
}

// Removes from both position and entitiesByPosition
function removePosition(entity: Entity): void {
  if (!positions[entity]) warn(`entity ${entity} doesn't HAVE a position to remove`)
    
  const position = positions[entity]!
  const entitiesAtPosition = entitiesByPosition[position]
  if (entitiesAtPosition){
    entitiesAtPosition.delete(entity)

    // And if set at that position is now empty, remove the set and return that position to random insert queue
    if (!entitiesAtPosition.size){
      entitiesByPosition[position] = undefined
      randomVacancies.reinsert(position)
    }

  }
  positions[entity] = undefined
}

// SPATIAL ENTITY : ENTITY + POSITION
function spawnSpatialEntity(position: Position | undefined = undefined): Entity {
  try {
    const newEntityPosition = position ? position : getRandomPositionValue()!
    if (newEntityPosition === -1) return -1
    return createSpatialEntity(newEntityPosition)
  } catch (e){
    throw new Error(`Error while spawning entity createEntity(): ${e}`)
  }
}

function createSpatialEntity(position: Position): Entity {
  try {
    const entity = createEntity()
    addPosition(entity, position)
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

// PLANTS
export function createPlant(level: Level, position: Position | undefined = undefined, ): void {
  try {
    console.log("CREATING PLANT AT POS", position)
    
    // prevent possibility of multiple plants in the same place
    if (position && inhabitantsAtPosition(position)) return

    let entity = spawnSpatialEntity(position)

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
  const inhabitants = entitiesByPosition[position]
  if (inhabitants) return true
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

  const position = positions[entity]
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

export function handlePlantLifecycles(): void {

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
export function getViewAsBuffer(position: number): Buffer {
  const viewSize = 4096; // 64x64 view
  const bitDepth = 2; // Each value needs 2 bits
  const bytesNeeded = viewSize / (8 / bitDepth); // 1024 bytes
  const buffer = Buffer.alloc(bytesNeeded);

  // Determine which view they are in
  const view = Math.floor(position / map.positionsPerView);
  const viewCol = view % 4; // Which fourth of each row this view corresponds to
  const firstRowInView = Math.floor(view / 4) * 64; // Find the first row
  // const firstPositionInView = view * map.positionsPerView;

  let tempArray: (0 | 1 | 2 | 3)[] = Array.from({length: viewSize}, ()=>0)

  // Extract values for the 64x64 section
  for (let row = 0; row < 64; row++){
    for (let col = 0; col < 64; col++){
      const mapRow = firstRowInView + row
      const mapCol = viewCol * 64 + col
      const pos = mapRow * 256 + mapCol

      const entitiesAtPosition = entitiesByPosition[pos];
      if (entitiesAtPosition?.size) {
  
        for (let entity of entitiesAtPosition) {
  
          // aminal
          // don't have any of these yet
          // const energy = energies[entity];
          // if (typeof energy === "number") {
          //   tempArray[i] = splitUp64(energy) as 0 | 1 | 2 | 3;
          //   break;
          // }
  
          // plont
          const lifespan = lifespans[entity];
          if (typeof lifespan === "number") {
            tempArray[row * map.cols + col] = splitUp64(lifespan) as 0 | 1 | 2 | 3;
          }
        }
      }
    }
  }


  // for (let i = 0; i < viewSize; i++) {
  //   const pos = firstPositionInView + i

  //   const entitiesAtPosition = entitiesByPosition[pos];
  //   if (entitiesAtPosition?.size) {

  //     for (let entity of entitiesAtPosition) {

  //       // aminal
  //       // don't have any of these yet
  //       // const energy = energies[entity];
  //       // if (typeof energy === "number") {
  //       //   tempArray[i] = splitUp64(energy) as 0 | 1 | 2 | 3;
  //       //   break;
  //       // }

  //       // plont
  //       const lifespan = lifespans[entity];
  //       if (typeof lifespan === "number") {
  //         tempArray[i] = splitUp64(lifespan) as 0 | 1 | 2 | 3;
  //       }
  //     }
  //   }
  // }

  // Pack the values into the buffer
  for (let i = 0; i < 1024; i++) {
    const v1 = tempArray[i * 4] & 0b11; // bitwise AND is wild
    const v2 = tempArray[i * 4 + 1] & 0b11;
    const v3 = tempArray[i * 4 + 2] & 0b11;
    const v4 = tempArray[i * 4 + 3] & 0b11;
    buffer[i] = (v1 << 6) | (v2 << 4) | (v3 << 2) | v4;
    
  }

  return buffer;
}



///

// function printBytesInBinary(buff: Buffer){
//   const binaryStrings = Array.from(buff)
//     .map(byte => byte.toString(2).padStart(8, '0')); // pad to ensure 8-bit representation
//   console.log(binaryStrings.join(' ')); // Print the binary representation of each byte
// }