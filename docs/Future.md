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