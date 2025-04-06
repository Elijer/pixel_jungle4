This will render everything as a circle

```ts
    // Caching circles
    // create a cache-canvas of exactly squareSize×squareSize
    const squareSize = offscreenCanvas.width / 64;
    const cachedShapes: any = []
    for (let i = 0; i < 4; i++){
      const cache = document.createElement("canvas");
      cache.width = cache.height = squareSize;
      const cctx = cache.getContext("2d")!;
      cctx.fillStyle = colors[i];
      cctx.beginPath();
      cctx.arc(
        squareSize/2, squareSize/2,
        squareSize/2, 0, 2*Math.PI
      );
      cctx.fill();
      cachedShapes.push(cache)
    }

    socket.on("u", (buff)=>{

      const squareSize = offscreenCanvas.width / 64;
      const { num12bit: tile, num2bit: pigment } = extractUpdate(buff);
      const row = Math.floor(tile/64)
      const col = tile % 64
      
      // cctx!.fillStyle = colors[pigment]
      // offscreenCtx!.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
      // if (num1bit === 1){
        // offscreenCtx!.fillStyle = colors[pigment];
        // offscreenCtx!.beginPath();
        // offscreenCtx!.ellipse(
        //   col * squareSize + squareSize / 2,
        //   row * squareSize + squareSize / 2,
        //   squareSize / 2,
        //   squareSize / 2,
        //   0, 0, 2 * Math.PI
        // );
        // offscreenCtx!.fill();
        offscreenCtx!.drawImage(
          cachedShapes[pigment],
          col * squareSize,
          row * squareSize
        );
      // }
    })
```