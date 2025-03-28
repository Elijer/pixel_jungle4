- I've made the same mistake here a few times when it comes to linking plant growth with mineral richness
- this is because what is recorded in lifespans can mean a couple things

1) They can mean the actual amount of cycles a plant will live before dying
2) But it ALSO determines when its children reproduce, as they are determined based on a place in lifespan

- I also want to mention how I keep making a mistake related to how unintuitively,
plants lifespans start as a high number, and decrements to 0
There's kind of a problem when birthtimes are calculated too close to inception
this is dangerous basically, because it can lead to these instantaneous flashes of growth
which is not what I want
I guess I want there to be a delay
What I've also found is that I actually really do like how the waves look
i.e., when birthtimes are determined in a straightforward way,
they produce waves
but when they are sufficiently random, they do not
The best of all worlds would be to have waves, while also having outliers that are somewhat random
maybe some really basic genetics could start to do this -
but that might be introducing complexity earlier than I should
let birthTime = Math.floor(normalLifespan - Math.random() * normalLifespan/2)

# Some different patterns I've found so far

# Crazy Waves
These are mistakes I made that led to some cool wave behavior for reasons I don't totally understand

## Crazy Waves A
```ts
// createPlant(){...
const normalLifespan = startingLifespanByLevel[level]
const actualLifespan = normalLifespan / (minerals[position]+1)
lifespans[entity] = actualLifespan

const childBirthtimes: number[] = []
for (let i = 0; i < 2; i++){
  // let birthTime = Math.floor((normalLifespan/3) + (Math.random() * normalLifespan / 3))
  let birthTime = Math.floor(normalLifespan - Math.random() * normalLifespan/2)
```

## Crazy Waves B
```ts
  let birthTime = Math.floor((actualLifespan/3) + Math.random() * actualLifespan / 3) + minerals[position] * 8
```

We're taking variations of a normalLifespan and creating birthtimes that are a third or a half of the way through it, in various ways.
If a lvl plant normal lifespan is 16, we might get example birthTimes of 14, 8, 11 in the CrazyWave A example
And in the CrazyWavesB, we might get some similiar numbers, and plenty of outliers that just won't get because of minerals[position]*8.

# Bell Curve / Standard Deviation
I think that it would actually be really interesting to see what standard deviation looks like as a pattern of reproduction here.