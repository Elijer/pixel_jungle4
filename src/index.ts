import setupServer from './lib/setupServer.js';
import { log } from './lib/logger.js';
import { GameInstance } from './lib/GameInstance.js';
const { io, port, httpServer } = setupServer();

const game = new GameInstance()

for (let i=0; i < 10000; i++){
  game.spawnPlant()
  game.spawnPlant()
  game.spawnPlant()
  game.spawnPlant()
}

setInterval(()=>{
  game.handlePlantLifecycles()
  const viewBuffer = game.getView();
  io.emit("view", viewBuffer);
}, 100)

io.on("connection", (socket) => {
  log("server connected")
  socket.emit("init", `SYSTEMS GO BRO`)
  socket.on("client-confirm", (msg)=>{
    log(`client confirmation: ${msg}`)
  })

  // Emit a binary buffer to the client as an example
  // const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]); // example binary data
  // socket.emit("bin", buffer);

  // setInterval(() => {
  //   const viewBuffer = game.getView();
  //   io.emit("view", viewBuffer);
  // }, 200);

  // socket.on("request-view", () => {
  //   const viewBuffer = game.getView();
  //   socket.emit("view-update", viewBuffer);
  // });
})

httpServer.listen(port, () => {
  log(`-->>> STARTED SERVER: ${port} <<<--`)
  console.log(`Listening on port ${port}`);
});