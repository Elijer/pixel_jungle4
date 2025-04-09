Working on player energy decrement events. ✅
Rendering these changes is 60% there - notes in handleEnergyDrainCycles
To continue, you may need to create a table of sockets - not the IDs, but a way to actually store all connections
So that they can be iterated through, and players can be updated with their energy level

However, need to add new class of events and user experience:
- death
- restart
- showing energy level
- messages about energy, etc.

Do just a little design before creating this part of API.

Good luck!

# Definitely some ideas
- Creating stacks for plants based on their maturity that determines how hard it is to "knock them down" / eat them. The idea here is really just that I think they are interesting obstacles, but being able to easily go through them sort of makes it not as interesting. Although, it's so easy to traverse the levels that this may have limited utility. And traversing the levels could be made harder, but then it would just be a click bash, which sounds lame too. It would be cooler if there was some skill involved.
- portals would be easy to implement
- It would also be really easy to create super simple predators that just sort of shot across the screen in straight-ish lines.
- Maybe there is a skill that's sort of minesweeper esque - where there is a risk of Cordyceps with every fungus? But in order to avoid that, you can do math, or maybe, you can match up the blinking of a piece of moss a the right time, like in abe's odysee.
- What if there was night and day? What if there were cycles, where the moss sped up and down?