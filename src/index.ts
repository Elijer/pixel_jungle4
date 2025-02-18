import setupServer from './lib/setupServer.js';
import { log } from './lib/logger.js';
const { io, port, httpServer } = setupServer();

io.on("connection", (socket) => {
  log("server connected")
  socket.emit("init", `SYSTEMS GO BRO`)
  socket.on("client-confirm", (msg)=>{
    log(`client confirmation: ${msg}`)
  })
})

httpServer.listen(port, () => {
  log(`-->>> STARTED SERVER: ${port} <<<--`)
  console.log(`Listening on port ${port}`);
});