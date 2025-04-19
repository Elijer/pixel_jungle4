Working on player energy decrement events. ✅
Rendering these changes is 60% there - notes in handleEnergyDrainCycles ✅
To continue, you may need to create a table of sockets - not the IDs, but a way to actually store all connections ✅
So that they can be iterated through, and players can be updated with their energy level ✅

However, need to add new class of events and user experience:
- death
- restart
- showing energy level ✅
- messages about energy, etc.

Do just a little design before creating this part of API.

Good luck!

# Stress Test
It's about time to test this thing on the network. Which means I have to deploy. Otherwise I don't really know how it will do.

# Predators
Okay so here's what I'm thinking
I have an ECS record of predators, so basically it's just a set of them, although, I'm not sure if I am going to have more than one, you know? Like how many predators should there be? I was thinking, originally, just one.

It might make sense for there to be some sort of ratio, but I don't really need to consider that now. I think it would be a good idea to treat the ECS as a set, and treat accessing it as a set, but to lock down the number of predators to just one for now.

So the way it should work is, a player joins and we check how many players there are. If there is only one, we don't really need to do anything.

We may send them the default prey message, something like "You are a humble ant! Eat lichen in order to survive, and get stronger in oder to eat denser types of lichen".

That just comes from event
0 - Welcome uninfected ant to game

And then some others I need are
1 - You died of hunger
2 - You can't go there (optioinal)(out of bounds about the edge of the map)
3 - You are low on food! (optional)

And then once I have that system set up, the idea is that if a second ant joins, the first ant will be infected with Cordyceps. They will get
4 - You have been infected with the cordyceps virus
4_Detail - In fact, to say "you" is to refer to someone else. You ARE cordyceps generation 1-___ (server instance name or something). You have been found by it, touched. Seen, and saved. You must save the others! Find them - by touching them, you can show them the light. You can connect them with the one true spirit of this world. Where you were once sustained by nutrients, you are now sustained only by the salvation of others. Find them, and feast upon their salvation together.

This will basically alter

# Definitely some ideas
- Creating stacks for plants based on their maturity that determines how hard it is to "knock them down" / eat them. The idea here is really just that I think they are interesting obstacles, but being able to easily go through them sort of makes it not as interesting. Although, it's so easy to traverse the levels that this may have limited utility. And traversing the levels could be made harder, but then it would just be a click bash, which sounds lame too. It would be cooler if there was some skill involved.
- portals would be easy to implement
- It would also be really easy to create super simple predators that just sort of shot across the screen in straight-ish lines.
- Maybe there is a skill that's sort of minesweeper esque - where there is a risk of Cordyceps with every fungus? But in order to avoid that, you can do math, or maybe, you can match up the blinking of a piece of moss a the right time, like in abe's odysee.
- What if there was night and day? What if there were cycles, where the moss sped up and down?