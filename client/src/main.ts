import './style.css';
import { io } from "socket.io-client";
// const jitterOn = true

// Replace with whatever URL you are using in production so socket knows where to turn to
const prodUrl = 'https://pixel-jungle4.onrender.com'
let socketAddress = window.location.hostname === "localhost" ? "ws://localhost:3000" : prodUrl
const socket = io(socketAddress)

// TODO: the server should be passing this kind of thing - there's a note in "connect" about this
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

// Create the flipped version with proper typing
const andNowYouAreTheFool: Record<number, string> = Object.entries(playerEventKey).reduce((acc, [key, value]) => {
  acc[value] = key;
  return acc;
}, {} as Record<number, string>);

function jumbotron(msg: string) {
  const jumbo = document.getElementById("jumbotron");
  if (!jumbo) return;
  
  // Clear current content
  jumbo.innerHTML = "";
  
  let charIndex = 0;
  const typingSpeed = 30; // 12 characters per second (in milliseconds)
  
  // Type each character one by one
  const typeNextChar = () => {
    if (charIndex < msg.length) {
      jumbo.innerHTML += msg.charAt(charIndex);
      charIndex++;
      setTimeout(typeNextChar, typingSpeed);
    } else {
      // When typing is complete, set timeout to clear the message
      setTimeout(() => {
        jumbo.innerHTML = gameconfig.defaultJumbotronMsg;
      }, gameconfig.jumbotronCooldown);
    }
  };
  
  typeNextChar();
}

// Grab the canvas
const canvas = document.getElementById("main-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");

// Create an off-screen canvas
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");

// const colors = ["black", "yellow", "orange", "red"]
const baseColors = [
  [0, 0, 0],    // Midnight blue
  [90, 150, 90],     // Moss green
  [0, 110, 110],   // Forest green
  [190, 140, 120],   // Turquoise
];

function jitterColor([r, g, b]: number[]): string {
  // const jitter = () => Math.floor(Math.random() * 120); // +/-5 range
  const jitter = () => Math.floor(Math.random() * 20) / 3
  // return `rgb(${r + jitter()}, ${g + jitter()}, ${b + jitter()})`;
  return `rgb(${r + jitter()}, ${g+jitter()*2}, ${b})`;
}

const energyCanvas = document.querySelector("#energy-canvas") as HTMLCanvasElement
const energyCtx = energyCanvas!.getContext("2d")

for (let i = 0; i<8; i++){
  for (let j = 0; j < 8; j++){
    energyCtx!.fillRect(i * 32 + 2, j * 32 + 2, 30, 30);
  }
}

socket.on("connect", ()=> {

  const squareSize = offscreenCanvas.width / 64;
  const cache = createCachedCircle(squareSize)

  // NOTE: By wrapping everything in an additional nest of "initial data", I can pass presets from server to client
  // like the map size, if that's ever needed
  // socket.off("initialData")
  // socket.on("initialData", (initialData)=>{

  const listenerController = new AbortController();
  const { signal } = listenerController; // add this to key bindings to efficiently clean them up

  socket.on("view", (buff) => {
    const squareSize = offscreenCanvas.width / 64;
    const dv = new DataView(buff);
    
    for (let i = 0; i < dv.byteLength; i++) {
      const byte = dv.getUint8(i);
      
      // Unpack in simple ascending order
      for (let j = 0; j < 4; j++) {
        const v = (byte >> (2 * j)) & 0b11;
        
        const color = v === 0 ? "black" : jitterColor(baseColors[v]);
        const tileNum = i * 4 + j;
        const row = Math.floor(tileNum / 64);
        const col = tileNum % 64;
        
        offscreenCtx!.fillStyle = color;
        offscreenCtx!.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
        // console.log(col * squareSize, row * squareSize, squareSize, squareSize);
      }
    }
  });

  // Assume we receive a 2-byte ArrayBuffer from WebSocket with opinionated encoding
  function extractUpdate(buffer: ArrayBuffer) {
    const view = new DataView(buffer);
    const packedValue = view.getUint16(0, false); // Read 16-bit integer (big-endian)

    const localPosition = packedValue >> 4; // Bits 15–4
    const val = (packedValue >> 2) & 0b11;  // Bits 3–2
    const isYou = (packedValue >> 1) & 0b1; // Bit 1

    return {
      localPosition,
      val,
      isYou: Boolean(isYou),
    };
  }
    
  // Assume we receive a 1-byte ArrayBuffer from WebSocket of value between 0 and 63 inclusive
  function extractSingleValueUpdate(buffer: ArrayBuffer) {
    const view = new DataView(buffer);
    const byte = view.getUint8(0); // Read 1 byte
  
    // Mask the lower 6 bits (0b00111111 === 63)
    const value = byte & 0b00111111;
  
    return value;
  }

  socket.on("t", (buff)=>{

    const squareSize = offscreenCanvas.width / 64;
    const { localPosition: tile, val: pigment, isYou: isYou } = extractUpdate(buff);
    const row = Math.floor(tile/64)
    const col = tile % 64

    offscreenCtx!.fillStyle = pigment === 0 ? "black" : jitterColor(baseColors[pigment]);
    offscreenCtx!.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);

    if (isYou){
      offscreenCtx!.drawImage(
        cache,
        col * squareSize,
        row * squareSize
      );
    }
  })

  socket.on("e", (buff)=>{
    const energy = extractSingleValueUpdate(buff)
    updateEnergyGrid(energyCtx!, energy);
  })

  socket.on("playerEvent", (buff)=>{
    const msg = andNowYouAreTheFool[extractSingleValueUpdate(buff)]
    jumbotron(msg)
  })

  socket.on("disconnect", ()=>{
    listenerController.abort();
    // document.removeEventListener("keydown", controlsListener)
  })

  // Add an event listener that creates input events to send the backend, but can be cancelled by aborting the signal
  document.addEventListener('keydown', controlsListener, { signal } )

})

const keyCommandBindings: { [key: string]: number } = {
  w: 0,
  s: 1,
  a: 2,
  d: 3,
  o: 4,
}

const controlsListener = throttle((event: KeyboardEvent) => {
  const commandCode = keyCommandBindings[event.key.toLowerCase()];
  if (commandCode !== undefined) {
    socket.emit("input", new Uint8Array([commandCode]));
  }
}, gameconfig.inputCooldownTime);

function throttle<T extends (...args: any[]) => void>(func: T, limit: number): T {
  let inThrottle: boolean;
  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  } as T;
}

// resizes both canvases dynamically
function resizeCanvas() {
  const baseSize = Math.min(window.innerWidth, window.innerHeight) * 0.90;
  const size = Math.floor(baseSize / 64) * 64; // Round down to nearest multiple of 64
  canvas!.width = size;
  canvas!.height = size;
  offscreenCanvas.width = size;
  offscreenCanvas.height = size;
}


// just clears canvas and copies offscreen to visible canvas
function renderToMainCanvas() {
    ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
    ctx!.drawImage(offscreenCanvas, 0, 0);
}

function animationLoop() {
  renderToMainCanvas();
  requestAnimationFrame(animationLoop); // Use requestAnimationFrame for smoother animation
}

resizeCanvas(); // would rather do this with css
animationLoop();

function createCachedCircle(squareSize: number){
  const cache = document.createElement("canvas");
  cache.width = cache.height = squareSize;
  const cctx = cache.getContext("2d")!;
  cctx.fillStyle = "rgba(0, 0, 0, 0.5)";  // purple with 50% opacity
  
  const radius = squareSize / Math.sqrt(3); // ~0.577 * squareSize
  
  cctx.beginPath();
  cctx.arc(
    squareSize / 2, // x center
    squareSize / 2, // y center
    radius / 2,     // smaller radius for 1/3 area
    0, 2 * Math.PI
  );
  cctx.fill();
  return cache
}


/**
 * Updates the energy grid visualization based on the current energy level
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} energy - Energy value between 0-63
 */
function updateEnergyGrid(ctx: CanvasRenderingContext2D, energy: number) {
  // Clear the canvas first
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  // Calculate how many squares to fill
  const squaresToFill = Math.max(0, Math.min(64, Math.floor(energy) + 1));
  
  // Loop through grid positions
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const squareIndex = i + j * 8; // Calculate index from 0-63
      
      if (squareIndex < squaresToFill) {
        // Determine color based on range
        let colorIndex = 3
        if (squareIndex < 32) colorIndex = 2
        if (squareIndex < 16) colorIndex = 1

        
        // Set fill color from the baseColors array
        const [r, g, b] = baseColors[colorIndex];
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        
        // Draw the square
        ctx.fillRect(i * 32 + 1, j * 32 + 1, 30.5, 30.5);
      }
    }
  }
}