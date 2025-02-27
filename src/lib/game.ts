import { LIFIQueue } from './utilities.js';
import { warn} from './logger.js';

type Entity = number
type Energy = number
type Level = 0 | 1 | 2
type Lifespan = number
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

// TODO: Maybe add a limit to the number of entities allowed?
let entityCount: Entity = 1 // starting at 1 minimizes risk of incorrect entity existence checks
let recycledEntities: number[] = []

const entities: Set<Entity> = new Set()

function recycleEntity(entity: Entity){
  if (recycledEntities.length > map.positions / 2){
    recycledEntities = []
  }
  recycledEntities.push(entity)
}

// Normal Traits
const energies: (Energy | undefined )[] = [] // energy and lifespans will actually end up being very similar values, interestingly
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
    console.log(`created ${entity}`)
    // if (entity % 100000 === 0 ) console.log(`created ${entity/1000000}`)
    return entity
  } catch (e){
    throw new Error(`problem creating entity: ${e}`)
  }
}

function removeEntityEntirely(entity: Entity){
  try {

    // simple traits
    energies[entity] = undefined
    levels[entity] = undefined
    lifespans[entity] = undefined
    predators.delete(entity)
    births[entity]

    // more entangled traits
    removePosition(entity)
    removeSocket(entity)

    // entity itself
    entities.delete(entity)
    recycleEntity(entity)
    console.log(`removed ${entity} entirely`)
    // if (entity % 100000 === 0) console.log(`removed ${entity/1000000} entirely`)
  } catch (e){
    throw new Error(`problem removing entity ${entity} entirely: ${e}`)
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
    throw new Error(`${e}`)
  }
}

function addPosition(entity: Entity, position: Position, ): void {
  try {
    if (position < 0 || position > map.positions) throw new Error(`createSpatialEntity specified position outside of possible position range ${position}`)
    if (!entitiesByPosition[position]) entitiesByPosition[position] = new Set()
    entitiesByPosition[position].add(entity)
    positions[entity] = position
  } catch(e) {
    throw new Error(`failed to add position ${e}`)
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
    positions[entity] = position
    const entityAtPosition = entitiesByPosition[entity]
    if (!entityAtPosition) entitiesByPosition[entity] = new Set()
    entitiesByPosition[entity]?.add(entity)
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
    let entity = spawnSpatialEntity(position)

    // this can happen if there's no room - the -1 trickles up, and we fail to create a plant
    if (entity === -1) return
    levels[entity] = level
    const lifespan = lifespanArchectypes[level]
    lifespans[entity] = lifespan

    
    const childBirthtimes: number[] = []
    for (let i = 0; i < 2; i++){
      // Get a random timestamp within organism's lifespan
      // TODO: add minerals to influence this
      childBirthtimes.push(Math.floor(lifespan * Math.random()))
    }

    // later birthtime first so we can pop off the smaller one from the end
    childBirthtimes.sort((a, b)=>b-a)
    // Random lifespans determined here
    births[entity] = childBirthtimes

  } catch (e){
    throw new Error(`Failed to createPlant @ ${position}: ${e}`)
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
      potentialNeighbors.push(position + dir)
    }
  }
  return potentialNeighbors
}

function lifespanAtPosition(position: Position): number {
  const inhabitants = entitiesByPosition[position]
  if (inhabitants){
    for (const inhabitant of inhabitants){
      if (typeof lifespans[inhabitant] === "number") return lifespans[inhabitant]
    }
  }
  return 0
}

function plantReproduce(entity: Entity): void {

  if (typeof lifespans[entity] !== "number") warn(`${entity} is not a plant, and we can't get seed positions for it`)

  const position = positions[entity]
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