"use strict";
exports.__esModule = true;
var config_js_1 = require("./config.js");
var utilities_js_1 = require("./utilities.js");
var logger_js_1 = require("./logger.js");
var compass = [
    -config_js_1["default"].viewWidth - 1,
    -config_js_1["default"].viewWidth,
    -config_js_1["default"].viewWidth + 1,
    -1,
    1,
    config_js_1["default"].viewWidth - 1,
    config_js_1["default"].viewWidth,
    config_js_1["default"].viewWidth + 1,
];
function createMap() {
    var rows = 64;
    var cols = 64;
    var viewRows = 4;
    var viewCols = 4;
    var views = 16;
    var positions = rows * cols * views;
    return { rows: rows, cols: cols, viewRows: viewRows, viewCols: viewCols, views: views, positions: positions };
}
var map = createMap();
// Normal Traits
var entityCount = 0;
var entities = new Set();
var energies = new Map();
var levels = new Map();
var positions = new Map();
var predator = new Set();
// Reverse Trait Maps
var positionsReverse = new Map();
var socketsReverse = new Map();
var q = new utilities_js_1.LIFIQueue(10);
// ENTITY
function createEntity() {
    var entity = entityCount++;
    entities.add(entity);
    return entity;
}
function removeEntity(entity) {
    entities["delete"](entity);
}
// POSITION
function assignRandomPosition() {
    return q.getNext();
}
function addPosition(entity, position) {
    var _a;
    try {
        if (!positionsReverse.has(position))
            positionsReverse.set(position, new Set());
        (_a = positionsReverse.get(position)) === null || _a === void 0 ? void 0 : _a.add(entity);
        positions.set(entity, position);
        return true;
    }
    catch (e) {
        return false;
    }
}
function removePosition(entity) {
    var _a, _b;
    if (!positions.has(entity))
        logger_js_1.warn("entity " + entity + " doesn't HAVE a position to remove");
    var position = positions.get(entity);
    (_a = positionsReverse.get(position)) === null || _a === void 0 ? void 0 : _a["delete"](entity);
    if (!((_b = positionsReverse.get(position)) === null || _b === void 0 ? void 0 : _b.size)) {
        positionsReverse["delete"](position);
        q.reinsert(position);
    }
    positions["delete"](entity);
}
// SPATIAL ENTITY : ENTITY + POSITION
function spawnSpatialEntity() {
    var position = assignRandomPosition();
    if (!position)
        throw new Error("next tile in queue was undefined - queue may be broken or map is full");
    createSpatialEntity(position);
}
function createSpatialEntity(position) {
    var _a;
    try {
        if (position < 0)
            throw new Error("invalid position to create spatial entity - less than 0");
        if (position > map.positions)
            throw new Error("can't create a spatial entity there - out of bounds");
        var entity = createEntity();
        if (!addPosition(entity, position))
            throw new Error("couldn't add position to " + entity);
        if (!positionsReverse.has(position))
            positionsReverse.set(position, new Set());
        (_a = positionsReverse.get(position)) === null || _a === void 0 ? void 0 : _a.add(entity);
        positions.set(entity, position);
    }
    catch (e) {
        logger_js_1.warn("Error while creating entity createEntity(): " + e);
    }
}
// predators: []
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
