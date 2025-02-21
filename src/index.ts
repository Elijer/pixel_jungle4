import setupServer from './lib/setupServer.js';
import { log } from './lib/logger.js';
import { handlePlantLifecycle, createPlant } from './lib/game.js';
const { io, port, httpServer } = setupServer();

for (let i=0; i < 10000; i++){
  createPlant(0, 16)
}

setInterval(()=>{
  handlePlantLifecycle()
}, 100)

httpServer.listen(port, () => {
  log(`-->>> STARTED SERVER: ${port} <<<--`)
  console.log(`Listening on port ${port}`);
});