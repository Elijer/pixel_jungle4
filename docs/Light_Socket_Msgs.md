# How to send binary-ish data over sockets
I don't want to send json over sockets - json is really heavy. I've designed this game to send highly compact binary messages. But I've never done that before! How do we do that?

So right out of the box, socket.io messages can be straight buffers and dataviews.

# Manual Buffer creation
```ts
const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04])
socket.emit('bin', buffer)
```
This is just sending the numbers 1, 2, 3, and 4.

This buffer object can't be sent directly.

This is how we could read it:

```ts
  socket.on("bin", (msg) => {
    const dataView = new DataView(msg)
    const receivedNumber = dataView.getUint32(0, true)
    console.log("Received number:", receivedNumber);
  })
```

What is the 0x01 thing happening here?
This type of notation is a way of representing numbers in hexadecimal (base 16) format. The `0x` prefix signifies that the number is written in hexadecimal rather than normal decimal (base 10). Note: like normal numbers, you don't need to put strings around these, since they are numbers.

# The Hexadecimal system
The hexidecimal system using a combination of the digits 0-9 and the numbers ABCDEF to represent 16 symbols. I think that this is useful because bits are often grouped as bytes (8 bits), so 2 hexadecimals together is effectively a byte. 0 - 9 still mean 1 to 9, but A is 10, and F is 15. An important gotcha is that although there are 16 total digits, it's 0 indexed, so the final digit, F, is 15 instead of 16.

Since 0 to 9 are the same, we just need to remember:
A: 10
B: 11
C: 12
D: 13
E: 14
F: 15

The method for translating a hexadecimal bit into a number is to take the value of the first number and raise 16 to that number. Then add the value of the second one.
So 0x1F
16^1 = 16
F = 15
16+15=31

I think that usually, the case-sensitivity of these letters doesn't matter when expressed in the `0x` format.2^4

# Javascript objects (client only?)

`ArrayBuffer` - Low level binary data representation in JavaScript that's used both on the client side AND the server side.

A fixed-length container for binary data. It can hold raw binary data, but doesn't allow us to directly manipulate - i.e. it's immutable. I have to use `views`, (like `Uint8Array` or `Int32Array`) to interact with data insie the `ArrayBuffer`. ArrayBuffers are representations of memory designed to store sequences of bytes. For example, if dealing with binary data from a file or image, I can use one of these. I guess they can have a pretty arbitrary length - just a big immutable binary bucket.

ArrayBuffers are part of the Web APIs and provide low level access to binary data essential for reading files, interacting with WebSockets, or using WebGL. So I guess it can ALSO be a stream - it's immutable to users, but maybe not to networks in this way?

`Buffer` objects - Unlike `ArrayBuffers`, which can be used on the client OR the server, the `Buffer` object is Node.js-specific. It's similar to an ArrayBuffer. Provides methods for reading and writing binary data directly in the form of bytes. It's optimized for streaming and working with data that doesn't easily fit into JS string or array types.

Internally, a buffer is backed by a `typed array`, (just like an ArrayBuffer`), but it has additional methods for manipulating and encoding binary data.

It seems like the main different is that `Buffer` provides methods for manipulation, whereas ArrayBuffers need to use external, typed arrays to access data, which cannot be manipulated directly, or encoded, or decoded.

# ArrayBuffer
```ts
// Create a new ArrayBuffer with 8 bytes (64 bits)
const buffer = new ArrayBuffer(8);

// Create a Uint8Array view over that ArrayBuffer
const view = new Uint8Array(buffer);
```

# Buffer (node)
```
// Create a new Buffer of size 8 bytes
const buffer = Buffer.alloc(8);

// Set the first byte of the buffer
buffer[0] = 42; // 0x2A

console.log(buffer[0]); // 42

// Convert the buffer to a string
const string = buffer.toString('utf-8');
console.log(string); // (empty string, but can encode/decode binary to text easily)
```