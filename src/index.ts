// import setupServer from './lib/setupServer.js';
// const { io, port, httpServer } = setupServer();
import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';
import path from 'path';
import { dirname } from './lib/utilities.js';
import { log } from './lib/logger.js';
import { handlePlantLifecycles, createPlant, getViewAsBuffer } from './lib/game.js';

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

io.on("connection", (socket) => {
  socket.emit("initialData", {
    // send player id,
    // maybe the initial update? or keep that in its own event
    // player location, which yeah, should be with the view
    // config like mapsize,
    // yeah!
  })

  socket.on("player joined", (playerId) => {
    // and then this part means that
    // The player received the initial data and they've joined
    // Maybe THIS is actually where they should the initial view?
  })

  socket.on("input", (input)=>{
    // yup player moved or ate something!
    // Gotta update state accordingly
  })

  socket.on("disconnecting", async(reason) => {
    // handle disconnect - 
    // teardown the player, etc.
  })
})

createPlant(0, 1) // at midpoint
createPlant(0, 320) // at midpoint
createPlant(0, 8200) // at midpoint

setInterval(()=>{
  handlePlantLifecycles()
  const buff = getViewAsBuffer(1)
  // io.emit("view", new Uint8Array(buff));
  // So this is where I will have a global list of subscriptions
  // And as players join, and as they move
  // I will keep them subscribed to whatever view they are in
  // And they will receive all changes to that view as they happen.
  // which I guess will be kinda tricky -
  // Will I have to pass the socket to the handlePlantLifeCycles?

  // const buff = getViewAsBuffer(1)
  // io.emit("view", new Uint8Array(buff)); // 4096 value is an example of a player who is actually in the first view, since it's the first position of the second row of the master grid
  // this actually will happen within connection...
}, 100)

httpServer.listen(port, () => {
  log(`-->>> STARTED SERVER: ${port} <<<--`)
  console.log(`Listening on port ${port}`);
});