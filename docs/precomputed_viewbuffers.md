# Benchmarks
Getting max of 67 for time it takes to run an interval every ms
and to fill up the entire grid.

Okay! I was wrong! We were at 48 for a while and then ended up on 61. It was the console logs! I came to a hasty conclusion. I want to look at the average.

# Initial attempt at precomputing view buffers failed

Which sort of makes sense. It's more complicated, and many more operations, so there are lots of ways it can be slower. I ask deepseek about it and got this:

# What deepseek thinks
The performance degradation in your refactored code is likely due to the overhead introduced by incrementally updating the view buffers during entity management. Here's a breakdown of the key issues and potential solutions:

Key Issues
Frequent Buffer Updates: Each plant creation/removal triggers a buffer update. As the number of entities grows, these updates add significant overhead to the simulation loop.

Redundant Calculations: getViewPositionFromPosition and buffer index/bit-shift calculations are repeated for every update, consuming CPU cycles.

Discrepancy in Data Representation: The refactored code uses plant level instead of lifespan for buffer values, which might not reflect dynamic state changes (though this doesn't directly affect performance).

Performance Optimization Strategies
1. Precompute View Data
Precompute view indices, buffer indices, and bit-shifts for all global positions during initialization. This replaces runtime calculations with fast lookups.

Implementation:

typescript
Copy
// Precompute during initialization
type ViewData = {
  viewIndex: number;
  bufferIndex: number;
  bitShift: number;
};

const precomputedViewData: ViewData[] = Array.from({ length: map.positions }, (_, position) => {
  const y = Math.floor(position / map.totalCols);
  const x = position % map.totalCols;
  const viewRow = Math.floor(y / map.rows);
  const viewCol = Math.floor(x / map.cols);
  const viewIndex = viewRow * map.viewCols + viewCol;
  
  const localY = y - (viewRow * map.rows);
  const localX = x - (viewCol * map.cols);
  const localPosition = localY * map.cols + localX;
  
  const bufferIndex = Math.floor(localPosition / 4);
  const positionFromLeft = localPosition % 4;
  const bitShift = positionFromLeft * 2;

  return { viewIndex, bufferIndex, bitShift };
});

// Optimized update function
function updateViewBufferAtPosition(position: Position): void {
  const data = precomputedViewData[position];
  const view = viewBuffers[data.viewIndex];
  const val = getRepValueAtPosition(position) & 0b11;
  view[data.bufferIndex] = (view[data.bufferIndex] & ~(0b11 << data.bitShift)) | (val << data.bitShift);
}
2. Batch Buffer Updates
Track changed positions during the lifecycle and update buffers in bulk at the end of each cycle, reducing the number of write operations.

Implementation:

typescript
Copy
let changedPositions: Set<Position> = new Set();

// During entity updates, add positions to the set
function removePosition(entity: Entity): void {
  // ... existing code ...
  changedPositions.add(positionThatExisted);
}

// After lifecycle processing, update buffers
function handlePlantLifecycles(): void {
  // ... existing code ...
  changedPositions.forEach(pos => updateViewBufferAtPosition(pos));
  changedPositions.clear();
}
3. Optimize Data Structures
Typed Arrays: Ensure viewBuffers use Uint8Array for optimal performance.

Cache getRepValueAtPosition: If a position is updated multiple times in a cycle, cache the result to avoid redundant checks.

4. Correct Data Representation
Ensure the buffer reflects dynamic values (like lifespan) if needed. If the original intent was to show lifespan stages, revert to using splitUp64(lifespan) instead of level.

Fix in getRepValueAtPosition:

typescript
Copy
function getRepValueAtPosition(position: Position): 0 | 1 | 2 | 3 {
  const animal = animalsByPosition[position];
  if (animal) return splitUp64(energies[animal]);

  const plant = plantsByPosition[position];
  if (plant) return splitUp64(lifespans[plant]); // Use lifespan instead of level

  return 0;
}
Conclusion
The refactored approach introduces overhead by updating buffers incrementally during entity management. By precomputing view data, batching updates, and ensuring efficient data handling, you can mitigate this overhead. The original code avoided these costs by deferring buffer generation until requested, which is more efficient for the simulation but less responsive for view updates. Choose an approach based on whether simulation speed or real-time view updates are more critical for your game.

# What I think
honestly, I think I need to do more testing. These approaches are just so different. The computeBufferOnRequest approach simply requires fewer operations, and because they are consecutively run in a loop, I think the CPU may have a much easier time of it. Whereas all these operations on write, constantly, with no breaks, always accessing the buffers separately rather than in a loop, are exactly the kind of thing the CPU struggles with.

So there are major improvements I can make that would involve batching the updates, and then running them all together.

But that's like...so similiar...to what I'm already doing.

Which really makes me feel like the only (potential!) weakness to the way I'm doing it now, which ends up being actually incredibly performant, is that 