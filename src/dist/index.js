"use strict";
exports.__esModule = true;
var setupServer_js_1 = require("./lib/setupServer.js");
var logger_js_1 = require("./lib/logger.js");
var game_js_1 = require("./lib/game.js");
var _a = setupServer_js_1["default"](), io = _a.io, port = _a.port, httpServer = _a.httpServer;
for (var i = 0; i < 10000; i++) {
    game_js_1.createPlant(0, 16);
}
setInterval(function () {
    game_js_1.handlePlantLifecycle();
}, 1000);
httpServer.listen(port, function () {
    logger_js_1.log("-->>> STARTED SERVER: " + port + " <<<--");
    console.log("Listening on port " + port);
});
