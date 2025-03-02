import setupServer from './lib/setupServer.js';
import { log } from './lib/logger.js';
import { handlePlantLifecycles, createPlant, getViewAsBuffer } from './lib/game.js';
const { io, port, httpServer } = setupServer();

createPlant(0, 6500) // at midpoint

setInterval(()=>{
  handlePlantLifecycles()
  // sending a pre-ordained section of the map - section 1
  // but later on this will be triggered
  // by changing views only
  const buff = getViewAsBuffer(4096)
  io.emit("view", new Uint8Array(buff)); // 4096 value is an example of a player who is actually in the first view, since it's the first position of the second row of the master grid
  // Around here, I have to actually send some data
}, 500)

httpServer.listen(port, () => {
  log(`-->>> STARTED SERVER: ${port} <<<--`)
  console.log(`Listening on port ${port}`);
});