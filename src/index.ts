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
  const { player, position } = game.createPlayer(socket.id)
  let view = game.getViewFromPosition(position)

  // Send initial view as a buffer
  socket.emit("view", game.getViewAsBuffer(position))

  // Join room for updates on current view
  socket.join(`v:${view}`)

  socket.on("disconnecting", async(reason) => {
    log(`player ${player} disconnected due to ${reason}`)
    game.destroyPlayerMuahaha(player)
  })

})

game.createPlant(1, 1) // at midpoint
game.createPlant(1, 320) // at midpoint
game.createPlant(1, 8200) // at midpoint

setInterval(()=>{
  game.handlePlantLifecycles()
}, 500)

httpServer.listen(port, () => {
  log(`-->>> STARTED SERVER: ${port} <<<--`)
  console.log(`Listening on port ${port}`);
});