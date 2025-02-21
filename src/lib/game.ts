import { LIFIQueue } from './utilities.js';
import { warn} from './logger.js';

// const compass = [
//   -config.viewWidth - 1,
//   -config.viewWidth,
//   -config.viewWidth + 1,
//   -1,
//   1,
//   config.viewWidth - 1,
//   config.viewWidth,
//   config.viewWidth + 1,
// ]

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
const energies: Map<Entity, number> = new Map()
const levels: Map<Entity, Level> = new Map()
const lifespans: Map<Entity, number> = new Map()
const positions: Map<Entity, Position> = new Map()
const predators: Set<Entity> = new Set()
const births: Map<Entity, number[]> = new Map()
const sockets: Map<Entity, string> = new Map()

// Trait Map
const traits = [
  energies,
  levels,
  lifespans,
  positions,
  predators,
  births,
  sockets
]

// Reverse Trait Maps
const entitiesByPosition: Map<Position, Set<Entity>> = new Map()
const entitiesBySocket: Map<string, Entity> = new Map()

const q = new LIFIQueue(map.positions);

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
    return entity
  } catch (e){
    throw new Error(`problem creating entity: ${e}`)
  }
}

function removeEntityEntirely(entity: Entity){
  try {
    entities.delete(entity)
    for (const trait of traits){
      trait.delete(entity)
    }

    removePosition(entity)
    removeSocket(entity)

    recycleEntity(entity)
  } catch (e){
    throw new Error(`problem removing entity ${entity} entirely: ${e}`)
  }
}

// POSITION
function getRandomPositionValue(): number {
  try {
    const nextPosition = q.getNext()
    if (!nextPosition) throw new Error(`could not get nextPosition from next-random-position queue - this should never happen`)
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
    q.reinsert(position)
  }
  positions.delete(entity)
}

// SPATIAL ENTITY : ENTITY + POSITION
function spawnSpatialEntity(position: Position | null = null): Entity {
  try {

    const newEntityPosition = position ? position : getRandomPositionValue()!
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
export function createPlant(level: Level, lifespan: number, position: Position | null = null, ): void {

  try {
    let entity = spawnSpatialEntity(position)
    levels.set(entity, level)
    let lifespanArchectype = lifespanArchectypes[level]
    const childBirthtimes: number[] = []
    for (let i = 0; i < 2; i++){
      // Get a random time that will occur within the organism's lifespan
      childBirthtimes.push(Math.floor(lifespanArchectype * Math.random()))
      // This is also where minerals can come into pplay
    }
    // Plant lifespan determined by parent
    lifespans.set(entity, lifespan)
    // Random lifespans determined here
    births.set(entity, childBirthtimes)

  } catch (e){
    throw new Error(`Failed to createPlant @ ${position}: ${e}`)
  }
}

export function handlePlantLifecycle(): void {
  console.log(levels)
  // for (const [entity, level] of levels){
  //   console.log(entity, level)
  // }
}

// setInterval(handlePlantLifecycle, 1000)

// TRANSFORMERS

  // predatorss: []

// type PlantLevel = 0 | 1 | 2

// class Plant {
  
//   game: GameInstance
//   level: PlantLevel
//   lifespan: number
//   tile: number
//   reprostructions: [number, number]
//   archetypicalLifespan: number

//   static energyGrantedByLevel = [ 8, 16, 32 ]

//     // Expressed in number of seconds * number of plantcycles per second
//   // I'm gonna do about 10, to make sure movement isn't too jerky
//   // The reprostruction randomness should handle staggering
//   static lifespanByLevel = [160, 320, 640]
//   static reproWindowAugmentBySoilRichness = [2.1, 2, 1.6, 1.2]

//   constructor(game: GameInstance, lifespan: number, level: PlantLevel, tile: number){
//     this.game = game
//     this.level = level
//     this.lifespan = lifespan
//     this.archetypicalLifespan = Plant.lifespanByLevel[this.level]
//     this.tile = tile
//     this.reprostructions = this.getBirthTimes()
//   }

//   decrementLifespan(): void {
//     this.lifespan--
//   }

//   // So what this does is, for malnourished soil, generates reproductive times
//   // That are more likely to occur after orgnanism is dead
//   // effectively reducing chance of plants in poor soil to reproduce twice successfully
//   // and vice versa
//   predestinedBirthtime(): number {
//     const archetypicalLifespan = Plant.lifespanByLevel[this.level]
//     const reproWindowExpanded = Plant.reproWindowAugmentBySoilRichness[this.level]
//     return Math.floor(Math.random() * archetypicalLifespan * reproWindowExpanded)
//   }

//   getBirthTimes = (): [number, number] => {
//     const times: number[] = []
//     times.push(this.predestinedBirthtime())
//     times.push(this.predestinedBirthtime())
//     return times.sort((a, b) => b - a) as [number, number]
//   }

//   dies(): void {
//     this.game.plantGrid[this.tile] = null
//   }
  
//   consumed(): number {
//     this.dies()
//     return Plant.energyGrantedByLevel[this.level]
//   }

//   getAllNeighborTiles(): number[] {
//     const neighbs = []
//     // const x = this.tile % config.viewWidth
//     // const y = Math.floor(this.tile / config.viewWidth)

//     for (const d of compass){
//       const neighborTile = this.tile + d

//       if (neighborTile >= 0 && neighborTile < config.totalTiles){
//         neighbs.push(neighborTile)
//       }
//     }
//     return neighbs
//   }

//   getNestableNeighborTiles(){
//     const neighbs = this.getAllNeighborTiles()
//     const nests = []
//     for (const n of neighbs){
//       const existingPlant = this.game.plantGrid[n]
//       if (existingPlant === null){
//         nests.push(n)
//         continue 
//       } else {
//         // So a baby lichen, with its new lifespan of 160, could kill
//         // higher level plants at the end of their lives
//         if (this.archetypicalLifespan > existingPlant.lifespan){
//           nests.push(n)
//         }
//       }
//     }
//     return nests
//   }

//   getRandomNestTile(): number {
//     const neighbs = this.getNestableNeighborTiles()
//     const randomNestTile = Math.floor(Math.random() * neighbs.length)
//     return neighbs[randomNestTile]
//   }

//   reproduce(): void {
//     if (!this.reprostructions) warn('plant trying to reproduce past instructions')
//     let childLifespan = this.reprostructions.pop()
//     const nestTile = this.getRandomNestTile()
//     let childLevel: PlantLevel = this.level

//     // 1 in 8 chance
//     if (this.level < 2 && Math.random() > .875 ){
//       childLevel += 1
//       childLifespan! *= 2
//     }
//     // TODO - make sure that emergent plant levels are happening sometimes
//     // TODO - is childLifespan ever undefined? It should be
//     this.game.plantGrid[nestTile] = new Plant(this.game, childLifespan!, childLevel!, nestTile)
//   }

// }

// export class GameInstance {
//   plantGrid: (Plant | null)[]

//   constructor(){
//     this.plantGrid = Array.from({length: config.totalTiles}, ()=>null)
//   }

//   getRandomTile(): number {
//     return Math.floor(Math.random() * this.plantGrid.length)
//   }

//   spawnPlant(){
//     const randomTile = this.getRandomTile()
//     this.plantGrid[randomTile] = new Plant(this, 160, 0, randomTile)
//   }

//   handlePlantLifecycles(){
//     for (let p = 0; p < this.plantGrid.length; p++){
//       if (!this.plantGrid[p]) continue
//       // console.log(this.plantGrid[p]?.lifespan)
//       const plant = this.plantGrid[p]
//       if (plant){

//         if (plant.lifespan <= 0){
//           plant.dies()
//         }

//         plant.decrementLifespan()
//         const nextReprostruction = plant.reprostructions[plant.reprostructions.length-1]
        
//         if (nextReprostruction <= plant.lifespan){
//           plant.reproduce()
//         }

//       }
//     }
//   }

//   getView(): Buffer {
//     const viewSize = 4096; // 64x64 view
//     const bitDepth = 2; // Each value needs 2 bits
//     const bytesNeeded = viewSize / (8 / bitDepth); // 4 values per byte
  
//     const buffer = Buffer.alloc(bytesNeeded);

//     for (let i = 0; i < viewSize; i += 4){
//       let byte = 0;
//       for (let j = 0; j < 4; j++){
//         const tileIndex = i + j
//         if (tileIndex >= this.plantGrid.length) break;
//         const plant = this.plantGrid[tileIndex];
//         const encodedValue = plant ? plant.level + 1 : 0;
//         byte |= encodedValue << (6 - j * 2);
//         console.log(byte)
//       }
//       buffer[i / 4] = byte;
//     }
  
//     // console.log(buffer)
  
//     return buffer;
//   }
  
// }