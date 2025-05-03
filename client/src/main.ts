import './style.css';
import { io } from "socket.io-client";

const prodUrl = 'https://pixel-jungle4.onrender.com'
let socketAddress = window.location.hostname === "localhost" ? "ws://localhost:3000" : prodUrl
const socket = io(socketAddress)

const gameconfig = {
  inputCooldownTime: 3,
  jumbotronCooldown: 2000,
  defaultJumbotronMsg: "---"
}

const playerEventKey: Record<string, number> = {
  "death by hunger": 0,
  "out of bounds": 1,
  "food warning": 2,
  "you got ate": 3,
  "error": 255,
}

const andNowYouAreTheFool: Record<number, string> = Object.entries(playerEventKey).reduce((acc, [key, value]) => {
  acc[value] = key;
  return acc;
}, {} as Record<number, string>);

function jumbotron(msg: string) {
  const jumbo = document.getElementById("jumbotron");
  if (!jumbo) return;

  jumbo.innerHTML = "";

  let charIndex = 0;
  const typingSpeed = 30;

  const typeNextChar = () => {
    if (charIndex < msg.length) {
      jumbo.innerHTML += msg.charAt(charIndex);
      charIndex++;
      setTimeout(typeNextChar, typingSpeed);
    } else {
      setTimeout(() => {
        jumbo.innerHTML = gameconfig.defaultJumbotronMsg;
      }, gameconfig.jumbotronCooldown);
    }
  };

  typeNextChar();
}

const canvas = document.getElementById("main-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");

const baseColors = [
  [0, 0, 0],
  [90, 150, 90],
  [0, 110, 110],
  [190, 140, 120],
];

function jitterColor([r, g, b]: number[]): string {
  const jitter = () => Math.floor(Math.random() * 20) / 3;
  return `rgb(${r + jitter()}, ${g + jitter() * 2}, ${b})`;
}

const energyCanvas = document.querySelector("#energy-canvas") as HTMLCanvasElement;
const energyCtx = energyCanvas!.getContext("2d");

for (let i = 0; i < 8; i++) {
  for (let j = 0; j < 8; j++) {
    energyCtx!.fillRect(i * 32 + 2, j * 32 + 2, 30, 30);
  }
}

let lastInputCommand: number | null = null;
let lastInputTime = 0;

socket.on("connect", () => {
  const squareSize = offscreenCanvas.width / 64;
  const cache = createCachedCircle(squareSize);

  const listenerController = new AbortController();
  const { signal } = listenerController;

  socket.on("view", (buff) => {
    const dv = new DataView(buff);
    for (let i = 0; i < dv.byteLength; i++) {
      const byte = dv.getUint8(i);
      for (let j = 0; j < 4; j++) {
        const v = (byte >> (2 * j)) & 0b11;
        const tileNum = i * 4 + j;
        const row = Math.floor(tileNum / 64);
        const col = tileNum % 64;
        const color = v === 0 ? "black" : jitterColor(baseColors[v]);
        offscreenCtx!.fillStyle = color;
        offscreenCtx!.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
      }
    }
  });

  function extractUpdate(buffer: ArrayBuffer) {
    const view = new DataView(buffer);
    const packedValue = view.getUint16(0, false);
    const localPosition = packedValue >> 4;
    const val = (packedValue >> 2) & 0b11;
    const isYou = (packedValue >> 1) & 0b1;
    return { localPosition, val, isYou: Boolean(isYou) };
  }

  function extractSingleValueUpdate(buffer: ArrayBuffer) {
    const view = new DataView(buffer);
    const byte = view.getUint8(0);
    const value = byte & 0b00111111;
    return value;
  }

  socket.on("t", (buff) => {
    const { localPosition: tile, val: pigment, isYou } = extractUpdate(buff);
    const row = Math.floor(tile / 64);
    const col = tile % 64;
    const squareSize = offscreenCanvas.width / 64;
    offscreenCtx!.fillStyle = pigment === 0 ? "black" : jitterColor(baseColors[pigment]);
    offscreenCtx!.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
    if (isYou) {
      offscreenCtx!.drawImage(cache, col * squareSize, row * squareSize);
    }
  });

  socket.on("e", (buff) => {
    const energy = extractSingleValueUpdate(buff);
    updateEnergyGrid(energyCtx!, energy);
  });

  socket.on("playerEvent", (buff) => {
    const msg = andNowYouAreTheFool[extractSingleValueUpdate(buff)];
    jumbotron(msg);
  });

  socket.on("disconnect", () => {
    listenerController.abort();
  });

  document.addEventListener('keydown', controlsListener, { signal });
});

const keyCommandBindings: { [key: string]: number } = {
  w: 0,
  s: 1,
  a: 2,
  d: 3,
  o: 4,
};

const controlsListener = (event: KeyboardEvent) => {
  const commandCode = keyCommandBindings[event.key.toLowerCase()];
  if (commandCode !== undefined) {
    const now = Date.now();
    if (now - lastInputTime >= gameconfig.inputCooldownTime) {
      lastInputTime = now;
      lastInputCommand = commandCode;
      socket.emit("input", new Uint8Array([commandCode]));
      applyOptimisticUpdate(commandCode);
    }
  }
};

function applyOptimisticUpdate(commandCode: number) {
  // Placeholder for optimistic update logic
  // Example: Move player locally if W/A/S/D is pressed
  if (commandCode >= 0 && commandCode <= 3) {
    console.log(`Applying optimistic move for command ${commandCode}`);
    // Implement local state updates here if desired
  }
}

function resizeCanvas() {
  const baseSize = Math.min(window.innerWidth, window.innerHeight) * 0.90;
  const size = Math.floor(baseSize / 64) * 64;
  canvas!.width = size;
  canvas!.height = size;
  offscreenCanvas.width = size;
  offscreenCanvas.height = size;
}

function renderToMainCanvas() {
  ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
  ctx!.drawImage(offscreenCanvas, 0, 0);
}

function animationLoop() {
  renderToMainCanvas();
  requestAnimationFrame(animationLoop);
}

resizeCanvas();
animationLoop();

function createCachedCircle(squareSize: number) {
  const cache = document.createElement("canvas");
  cache.width = cache.height = squareSize;
  const cctx = cache.getContext("2d")!;
  cctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  const radius = squareSize / Math.sqrt(3);
  cctx.beginPath();
  cctx.arc(squareSize / 2, squareSize / 2, radius / 2, 0, 2 * Math.PI);
  cctx.fill();
  return cache;
}

function updateEnergyGrid(ctx: CanvasRenderingContext2D, energy: number) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const squaresToFill = Math.max(0, Math.min(64, Math.floor(energy) + 1));
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const squareIndex = i + j * 8;
      if (squareIndex < squaresToFill) {
        let colorIndex = 3;
        if (squareIndex < 32) colorIndex = 2;
        if (squareIndex < 16) colorIndex = 1;
        const [r, g, b] = baseColors[colorIndex];
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(i * 32 + 1, j * 32 + 1, 30.5, 30.5);
      }
    }
  }
}
