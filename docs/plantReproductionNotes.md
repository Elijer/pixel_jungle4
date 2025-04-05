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


Archived create plant function with notes:
```ts
  // PLANTS
  function createPlant(level: Level, position: Position | undefined = undefined, ): void {
    // see docs for the difficulties of these patterns
    try {
      
      // prevent possibility of multiple plants in the same place
      if (position && inhabitantsAtPosition(position)) return
      if (!position) return

      // let entity = spawnSpatialEntity(position)
      let entity = createSpatialEntity(position, plantPositions, plantsByPosition)

      // this can happen if there's no room - the -1 trickles up, and we fail to create a plant
      if (entity === -1) return
      levels[entity] = level
      const normalLifespan = startingLifespanByLevel[level]
      // const actualLifespan = normalLifespan / (minerals[position]+1)
      lifespans[entity] = normalLifespan
      
      const childBirthtimes: number[] = []
      for (let i = 0; i < 2; i++){
        // let birthTime = Math.floor((normalLifespan/3) + (Math.random() * normalLifespan / 3))
        // let birthTime = Math.floor(normalLifespan - Math.random() * normalLifespan/2)
        
        // and this is what used to be here:
        // Get a random timestamp within organism's lifespan
        // TODO: add minerals to influence this
        // The idea here is that I want variation in lifespans, but I don't want plants
        // having a chance to reproduce milliseconds after being born, that's causes flashgrowth problems
        // let birthTime = Math.floor((lifespan/3) + Math.random() * lifespan / 3) + minerals[position] * 5


        // So a birth takes between the full length of a parent and 4/5ths of a parents life
        // And further reduced by the minerals 
        // let birthTime = normalLifespan / (minerals[position]) - normalLifespan*.90
        // let birthTime = normalLifespan / (minerals[position]) - normalLifespan*.98
        let birthTime = normalLifespan*.99-minerals[position]*14
        // birthTime = Math.min(birthTime, normalLifespan*.9) // don't let it get shorter than .3
        // let birthTime = Math.floor((normalLifespan / 5 * Math.random() - normalLifespan/7 / minerals[position]))
        // let birthTime = Math.floor((actualLifespan/3) + Math.random() * actualLifesssssssssssssspan / 3) + minerals[position] * 8
        childBirthtimes.push(birthTime)
      }

      // later birthtime first so we can pop off the smaller one from the end
      childBirthtimes.sort((a, b)=>b-a)
      // Random lifespans determined here

      // Get representation of tile, pack it into a buffer, send it over to the right room for the v
      births[entity] = childBirthtimes

      sendUpdate(position, level)

    } catch (e){
      const msg = `Failed to createPlant @ ${position}: ${e}`
      warn(msg)
      throw new Error(msg)
    }
  }
```