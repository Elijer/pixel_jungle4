import setupServer from './lib/setupServer.js';
import { log } from './lib/logger.js';
import { handlePlantLifecycles, createPlant, getViewAsBuffer, entities } from './lib/game.js';
const { io, port, httpServer } = setupServer();

createPlant(0, 1) // at midpoint
createPlant(0, 320) // at midpoint
createPlant(0, 8200) // at midpoint

setInterval(()=>{
  handlePlantLifecycles()
  const buff = getViewAsBuffer(1)
  io.emit("view", new Uint8Array(buff));
}, 1)

httpServer.listen(port, () => {
  log(`-->>> STARTED SERVER: ${port} <<<--`)
  console.log(`Listening on port ${port}`);
});