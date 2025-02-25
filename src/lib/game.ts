import { LIFIQueue } from './utilities.js';
import { warn} from './logger.js';

type Entity = number
type Level = 0 | 1 | 2
type Position = number

const lifespanArchectypes = [
  // measured in 100s of ms
  16, 32, 64
]

function getMapConfig(){
  const rows = 64
  const cols = 64
  const viewRows = 4
  const viewCols = 4
  const views = 16
  const positions = rows * cols * views
  return {rows, cols, viewRows, viewCols, views, positions}
}

const map = getMapConfig()

const compass = [
  -map.cols - 1,
  -map.cols,
  -map.cols + 1,
  -1,
  1,
  map.cols - 1,
  map.cols,
  map.cols + 1,
]

let entityCount: Entity = 0
let recycledEntities: number[] = []

const entities: Set<Entity> = new Set()

function recycleEntity(entity: Entity){
  if (recycledEntities.length > map.positions / 2){
    recycledEntities = []
  }
  recycledEntities.push(entity)
}

// Normal Traits
const energies: (number | null )[] = []
const levels: (Level | null )[] = []

// Lifespan and energy are gonna be pretty different actually.
// should I combine them?
// At least the decrement part?
const lifespans: Map<Entity, number> = new Map()
const positions: Map<Entity, Position> = new Map()
const predators: Set<Entity> = new Set()
const births: Map<Entity, number[]> = new Map()
const sockets: Map<Entity, string> = new Map()

// Reverse Trait Maps
const entitiesByPosition: Map<Position, Set<Entity>> = new Map()
const entitiesBySocket: Map<string, Entity> = new Map()

const queue = new LIFIQueue(map.positions);

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
    console.log(`created ${entity}`)
    return entity
  } catch (e){
    throw new Error(`problem creating entity: ${e}`)
  }
}

function removeEntityEntirely(entity: Entity){
  try {

    // simple traits
    energies[entity] = null
    levels[entity] = null
    lifespans.delete(entity)
    predators.delete(entity)
    births.delete(entity)

    // more entangled traits
    removePosition(entity)
    removeSocket(entity)

    // entity itself
    entities.delete(entity)
    recycleEntity(entity)
    console.log(`removed ${entity} entirely`)
  } catch (e){
    throw new Error(`problem removing entity ${entity} entirely: ${e}`)
  }
}

// POSITION
function getRandomPositionValue(): number {
  try {
    const nextPosition = queue.getNext()
    // if (!nextPosition) throw new Error(`could not get nextPosition from next-random-position queue - this should never happen`)
    if (!nextPosition){
      warn(`looks like there is no more space for now!`)
      return -1
    }
    return nextPosition
  } catch (e){
    throw new Error(`${e}`)
  }
}

function addPosition(entity: Entity, position: Position, ): void {
  try {
    if (position < 0 || position > map.positions) throw new Error(`createSpatialEntity specified position outside of possible position range ${position}`)
    if (!entitiesByPosition.has(position)) entitiesByPosition.set(position, new Set())
      entitiesByPosition.get(position)?.add(entity)
      positions.set(entity, position)
  } catch(e) {
    throw new Error(`failed to add position ${e}`)
  }
}

// Removes from both position and entitiesByPosition
function removePosition(entity: Entity): void {
  if (!positions.has(entity)) warn(`entity ${entity} doesn't HAVE a position to remove`)
    
  const position = positions.get(entity)!
  entitiesByPosition.get(position)?.delete(entity)
  if (!entitiesByPosition.get(position)?.size){
    entitiesByPosition.delete(position)
    queue.reinsert(position)
  }
  positions.delete(entity)
}

// SPATIAL ENTITY : ENTITY + POSITION
function spawnSpatialEntity(position: Position | null = null): Entity {
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
    positions.set(entity, position)
    if (!entitiesByPosition.has(position)) entitiesByPosition.set(position, new Set())
    entitiesByPosition.get(position)?.add(entity)
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
export function createPlant(level: Level, position: Position | null = null, ): void {
  try {
    let entity = spawnSpatialEntity(position)

    // this can happen if there's no room - the -1 trickles up, and we fail to create a plant
    if (entity === -1) return
    levels[entity] = level
    const lifespan = lifespanArchectypes[level]
    lifespans.set(entity, lifespan)

    
    const childBirthtimes: number[] = []
    for (let i = 0; i < 2; i++){
      // Get a random time that will occur within the organism's lifespan
      childBirthtimes.push(Math.floor(lifespan * Math.random()))
      // This is also where minerals can come into pplay
    }
    // later birthtime first so we can pop off the smaller one from the end
    childBirthtimes.sort((a, b)=>b-a)
    // Random lifespans determined here
    births.set(entity, childBirthtimes)

  } catch (e){
    throw new Error(`Failed to createPlant @ ${position}: ${e}`)
  }
}

function decrementLifespan(entity: Entity): void {
  if (lifespans.has(entity)){
    const lifespan = lifespans.get(entity)!
    if (lifespan === 0){
      removeEntityEntirely(entity)
    } else {
      lifespans.set(entity, lifespan - 1)
    }
  }
}

function getNeighborPositions(position: Position): Position[] {
  const potentialNeighbors = []
  for (const dir of compass){
    const potentialNeighbor = position + dir
    if (potentialNeighbor >= 0 && potentialNeighbor < map.positions){
      potentialNeighbors.push(position + dir)
    }
  }
  return potentialNeighbors
}

function lifespanAtPosition(position: Position): number {
  if (entitiesByPosition.has(position)){
    const inhabitants = entitiesByPosition.get(position)!
    for (const inhabitant of inhabitants){
      if (lifespans.has(inhabitant)) return lifespans.get(inhabitant)!
    }
  }
  return 0
}

function plantReproduce(entity: Entity): void {

  if (!lifespans.has(entity)) warn(`${entity} is not a plant, and we can't get seed positions for it`)

  const position = positions.get(entity)
  if (!position) throw new Error(`plantReproduce failed to get parent location ${entity}`)

  const level = levels[entity]!
  const lifespan = lifespanArchectypes[level]
  if (!lifespan) throw new Error(`plantReproduce failed to get level of parent`)

  const seedPositions: Position[] = []
  const neighborPositions = getNeighborPositions(position)
  for (const neighboringPosition of neighborPositions){
    if (lifespanAtPosition(neighboringPosition) / 3 >= lifespan) continue
    seedPositions.push(neighboringPosition)
  }

  const randomSeedPosition = seedPositions[Math.floor(Math.random() * seedPositions.length)]
  createPlant(level, randomSeedPosition)
}

export function handlePlantLifecycle(): void {

  for (let [entity, lifespan] of lifespans){

    if (births.has(entity)){
      if (!births.get(entity)!.length){
        births.delete(entity)
      } else {
        const birthTimes = births.get(entity)!
        if (birthTimes[birthTimes.length-1] >= lifespan){
          birthTimes.pop()
          plantReproduce(entity)
        }
      }
    }

    decrementLifespan(entity)
  }
}