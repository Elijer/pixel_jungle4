// bun benchmarks/sparseOrDense.ts
// specifically interested in the performance of arrays that start out as completely undefined

const lengths = 10000000

function addRanValAtRandPoint(arr: any[]): void {
  const i = Math.floor(Math.random() * lengths)
  const val = Math.random()*100
  arr[i] = val
}

console.time("sparse")
const sparse = []
for (let i = 0; i < lengths * 2; i++) addRanValAtRandPoint(sparse)
console.timeEnd("sparse")

console.time("dense")
const dense = Array.from({length: lengths}, ()=>undefined)
for (let i = 0; i < lengths * 2; i++) addRanValAtRandPoint(sparse)
console.timeEnd("dense")

console.time("dense2")
const dense2 = Array.from({length: lengths})
for (let i = 0; i < lengths * 2; i++) addRanValAtRandPoint(sparse)
console.timeEnd("dense2")

/*

Results @ lengths = 10K

[3.75ms] sparse
[2.61ms] dense
[1.22ms] dense2

Results @ lengths = 10M

[2.19s] sparse
[1.65s] dense
[1.61s] dense2

Interpretation
At smaller sizes, the implicit dense array is the winner, performing a lot better than the explicit one
And both of those are significantly better than the sparse array

At larger sizes, they are STILL both about 70% better, and the difference between the latter two evens out.
Keep in mind also, that the dense arrays are outperforming the sparse one even after having to, ostensibly, 
fill themselves. That said, they probably don't need to fill much of anything, as JS could easily just say
hey, allocate this memory, but not iteration is needed - there's nothing here
which is essentially the same situation as the sparse one.

What does this tell us?
Use a dense array. And ideally, don't explicitly define the undefined values - this is a bit hard with typing, but it should go.
*/