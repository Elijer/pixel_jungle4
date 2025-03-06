# WIP
Okay so here's my work and what I've done
@C - updateBasedSocketEvents branch: I made some progress with updating the socket events to handle updates AND full view updates, pulling code from pixel_jungle3 (which is rock solid and recommend to continue using for guidance).
@B - binaryRepMap branch: I started sketching out a way to have a sort of persistent binary representation of the map at any given point, so that view updates don't need to recompute from scratch every time, which doesn't really make sense. This is a big project because I need EVERY state change to do this, and I also need to wrap my head around how to use binary operations

But what I want to do before either of these is to separate positions and getEntityByPosition into plantPositions and animalPositions, AND getPlantByPosition and getAnimalByPosition, since these two different entity types are able to occupy the same spaces. I'm relatively confident this will make the codebase much easier to work with, and it will definitely get rid of some (theoretical) performance bottlenecks. In reality, it's plenty fast, but it just kind of pains me to work with, and @B will end up interacting with the system pretty extensively, so it makes sense to do this first.

However, if this DOESN'T end up working out, I want the changes here to be isolated so I can roll them back without affecting C or B

So that means my plan of attack will be:

A - separate the positions in ECS state
B - Create a write-heavy read-lite binary representation of state
C - Return back to sockets, where I can continue the re-architecture where an initial view is sent, and after that, only updates.

After that, we have player interaction, computing views when players change screens, minerals grids, and all sorts of other fun stuff.

# Guiding Principles
- walk before run - "I'd like to have 1mil squares!" is that important to the mvp? No. Stick to one thing at a time. You already have a lot of complexity. I've found a lot of joy and power in keeping things simple. Don't stray.
- Multiplayer - integrate an actually interesting, playable game into this

# Split plant and animal positions.
I think there's a good chance this would both make my code easier to reason about AND improve performance, maybe significantly.

This would especially work as long as the idea of "position" between plants and animals isn't completely the same. Ideally, they wouldn't interact at all...

But I WAS planning on not letting lower level players move past higher level plants, and I think this is important, so it does remain important to let animals check plants and vice versa.

That said, I think it could still be more performant and clearer - consider before implementing though. I'm not positive it's worth it yet.

# Cache a representationGrid
The idea here is to maintain a representation of the entire world in a 65,536 tile array. Instead of computing changes on socket update events, instead whenever a change to the world occured, this state would be updated.

It wouldn't serve as the source of truth, but rather a sort of pre-computation of the state sent over the network. In other words, it should never be consulted for state if I'm going to be really careful. In theory though, it could be helpful to consult for state. For example, it could slightly faster to consult about which squares were occupied than consulting the sets. But I digress.

It doesn't make any sense to compute state whenever a player requests it, and doesn't scale well. This scales infinitely

# Compression
Verdict: probably not necessary for views, defintiely not necessary for updates
Ultimately I think this could reduce network costs by 4x, and even improve CPU usage because - hear me out - I could do compression on view requests, so I only have to do it max once per view per player. This means that a lot of the time, I wouldn't need to do it, and when I did, I would only be doing about .1ms of labor, one time per tick, and sending that.

That said, since the compressed maps are only valid for a single tick...this only really helps if a lot of players entered the same view at the same time, which, if they do, would be a big bottleneck, but the chances of this happening in the same tick are low. It might be better just not to compress at all, honestly, since sending the entire view is going to be sort of uncommon.

the only reason this WOULDN'T be the case is if was possibly to update a compression every tick without unpacking it. But that seems crazy. It seems possible. But. Crazy.

# Send player position updates with state
I do have a little challenge, which is that if I want to send things in just a KB, I've run out of room to also send 2 additional bytes about where the player is. This may not matter at all, especially since most of the time the 

# Updates
Right now, I am sending updates of the entire world every tic, which is of course not the end game. I want to just send diffs, which will be much more performance, and will involve getting an entire view initially, and whenever a player switches views, and then just updating it.

An additional improvement could be to keep all surrounding views up to date, and load new views as a player approaches them, but this seems sort of like overkill. Getting a 1KB view is very lightweight and not that big a deal. That's just a megabyte for a thousand players, and that's a thousand players switching views, which won't even happen.

# 100x
Consider doing 100x100 for easier math.
Alternatively, consider doing 1024x1024 or 1000x1000 so I can hit a million tiles. That would be cool.
The OG plan though, which I still do think is worth considering, is to expand things out one more level.
64x64 grids of 256 tiles.

Originally I was thinking, essentially the same for factor, but you actually only see 16x16 at a time, it's like LOS.
This means that basically, payloads are crazy small for views, and I could potentially just load views all day, no updates.

But actually, the view updates would still be a half kb, so still a lot compared to updates.

I think the other way to do this is use essentially the existing way things are, but allow a player to "zoom out", seeing cached values of the other 64*64 places they'd been displayed. It would help you orient yourself. I could do this without really changing much.

In that world, then, maybe imagine that the 16 view "maps" you'd get to see where STILL only 1/16th of the entire world. So yes, that entire world WOULD be 1024.

The difference would be that I expanded the world, and I would just add the LOS as a way to help you actually deal with that, and to explore, which is sort of the point of the game and would be kind of exciting I think, and help you find cool stuff and remain oriented.

# GPU
Since I've gotten things to be a bit more abstracted, more numeric, I can start to imagine how this might be possible.