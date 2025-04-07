import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';
import path from 'path';
import { dirname } from './lib/utilities.js';
import { log } from './lib/logger.js';
import initializeGame from './lib/game.js';

const app = express();
const httpServer = createServer(app);
const pathToBuild = path.join(dirname(), '../../', 'client', 'dist')
app.use(express.static(pathToBuild));

// Heroku passes the PORT env into the environment
let port = process.env.PORT || 3000;

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const game = initializeGame(io)

io.on("connection", (socket) => {
  const { player, position } = game.createPlayer(socket)
  let view = game.getViewFromPosition(position)

  // Send initial view as a buffer
  socket.emit("view", game.getViewAsBuffer(position))

  // Join room for updates on current view
  socket.join(`v:${view}`)

  // const keyCommandBindings: { [key: string]: number } = {
  //   w: 0: up,
  //   s: 1: down,
  //   a: 2: left,
  //   d: 3: right,
  //   o: 4: eat
  // }
  
  socket.on('input', ([commandCode])=>{
    if (commandCode === 4){
      game.playerEat(socket, player)
    } else {
      game.playerMove(socket, player, commandCode)
    }
  })

  socket.on("disconnecting", async(reason) => {
    log(`player ${player} disconnected due to ${reason}`)
    game.destroyPlayerMuahaha(player)
  })

})

for (let i = 0; i < 100; i++){
  game.createPlant(1, game.getRandomPositionValue()) // at midpoint
}

setInterval(()=>{
  game.handlePlantLifecycles()
}, game.config.plantCycle)

setInterval(()=>{
  game.handleEnergyDrainCycles()
}, game.config.energyDrainCycle)

httpServer.listen(port, () => {
  log(`-->>> STARTED SERVER: ${port} <<<--`)
  console.log(`Listening on port ${port}`);
});