import './style.css';
import { io } from "socket.io-client";

const herokuUrl = 'set the url for whatever service you are using'
let socketAddress = window.location.hostname === "localhost" ? "ws://localhost:3000" : herokuUrl
const socket = io(socketAddress)

// Grab the canvas
const canvas = document.querySelector("canvas");
const ctx = canvas!.getContext("2d");

// Create an off-screen canvas
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");

const colors = ["black", "yellow", "orange", "red"]

// TODO: the server should be passing this kind of thing - there's a note below about this
const gameconfig = {
  inputCooldownTime: 60 
}

socket.on("connect", ()=> {

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
          
          const color = colors[v];
          const tileNum = i * 4 + j;
          const row = Math.floor(tileNum / 64);
          const col = tileNum % 64;
          
          offscreenCtx!.fillStyle = color;
          offscreenCtx!.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
        }
      }
    });

    // Assume we receive a 2-byte ArrayBuffer from WebSocket
    function extractUpdate(buffer: ArrayBuffer) {
      const view = new DataView(buffer);
      const packedValue = view.getUint16(0, false); // Read 16-bit integer (big-endian)

      const localPosition = packedValue >> 4; // Bits 15–4
      const val = (packedValue >> 2) & 0b11;  // Bits 3–2
      const isYou = (packedValue >> 1) & 0b1; // Bit 1
      console.log({localPosition, val, isYou})

      return {
        localPosition,
        val,
        isYou: Boolean(isYou),
      };
    }

    // Cached circle thing
    const squareSize = offscreenCanvas.width / 64;
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

    socket.on("u", (buff)=>{

      const squareSize = offscreenCanvas.width / 64;
      const { localPosition: tile, val: pigment, isYou: isYou } = extractUpdate(buff);
      const row = Math.floor(tile/64)
      const col = tile % 64

      offscreenCtx!.fillStyle = colors[pigment]
      offscreenCtx!.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);

      if (isYou){
        offscreenCtx!.drawImage(
          cache,
          col * squareSize,
          row * squareSize
        );
      }
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
  o: 4
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
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.90;
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