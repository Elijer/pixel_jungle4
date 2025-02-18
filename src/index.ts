import setupServer from './lib/setupServer.js';
import { log } from './lib/logger.js';
const { io, port, httpServer } = setupServer();


httpServer.listen(port, () => {
  log(`-->>> STARTED SERVER: ${port} <<<--`)
  console.log(`Listening on port ${port}`);
});