To Do Sequence

> Player Indicator, movement, eating and energy
- send a true or false on 'u' (update) to let player know that the update is THEM, thereby updating the marker that shows where their position is
- Add additional command allowing players to eat blocks
- Handle the eat blocks command
- Increment player energy
- Make sure players of a certain energy can move past blocks of a certain level (16 can move on level 2, 32 can move on 3, etc)
  - So I suppose players can ALSO eat blocks below them, since if movement is blocked I don't need to handle eating as well
- Handle
- Create energy decrementer
- Create new events that sound out energy decrement events
- Handle death
- Make a message on the frontend of some kind that handles death

> Predator dynamics
- Events to handle
- handling the assignment of predators, and a player switching to a predator
- handling predator health decrement differently
- handling the instructions on the frontend somewhat

------- All the stuff, brainstorming -----
- If there is only one player, they are an herbivore
- They are given about 1 minute of life
- After a minute, with no intervention, they die
- So if the level checkpoints are 16, 32, 64
  - every "energy" is worth 4 seconds. So 16 energy is about a minute
  - 32 is about 2 minutes
  - 64 is about 4 minutes of survival
  - I can also change how many seconds an energy point is
  - The important thing is that you need to keep eating, otherwise you die
  - (optional) I could make moving an energy expense, but pocketing that
- Predators are similar, but they always get 4 minutes (or x minutes, whatever)
- And whenever they "get" another player, they get that time again
- So in each case, energy is being incremented and decremented on a cycle every n seconds

- The client needs to know about some but not all of this

Question - if I could just send a timestamp though, I wouldn't NEED to send an update every cycle. Would this be better?

- Predator client
- Knows every decrement. Can see "health" decreasing.
- predators just need to "walk over" a player to eat them
- they get 4 minutes or whatever back by doing this.

- Prey client
- Knows every decrement. Can see "health" decreasing.
- At every checkpoint, they essentially level up.
- They can walk over plants that are at their level or below.
- So all players can walk over level 1 plants
- players with more than 16 energy can walk over level 2 plants
- players with more than 32 energy can walk over / eat level 3 plants
- A level 1 plant gives you one energy I think (that's 4 seconds each, which isn't bad)
- a level 2 plant gives you however much energy corresponds to its rareness
- And same for level 3, which are quite rare.
- Players press n or something to eat a plant, and can choice to do so


Displays
- Client Displays
  - They may also see some graphic representation of their character or whatever to show they are a nice ant
  - As they level up, this evolves
  - So a client can see an array of squares or something that says "health", which tells it how healthy it is
  - Not necessary to let a player know that cordyceps is on the loose I don't think

- Predator displays
  - A predator sees a graphic representation of their character to show that they are infected with the Cordyceps virus
    - and that they like it
  - A predator sees its health bar going down with time.
  - They may get some warnings too