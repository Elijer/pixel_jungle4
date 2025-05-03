# Batching
It wouldn't be hard at all to 
- set a period of time a batch happens in, say 16ms (amount of times a 60fps frame would run in a second)
  - just send a stack of however many 2 byte updates you've got - because they are each 2 bytes, it's easy to break them up again on the other side
  - But as soon as that stack reaches 2kibibytes, that's when you can switch to a full view update. So that's the point when half of the map has updated.
  - Becuase of processing and stuff though, it could probably be less. But we'll probably never get to that anyway, so not really a useful innovation
  - But BATCHING is. Because the overhead of each message is like 10x that of the payload I think


# The cost of single messages
39+2 or 39+1, so 40 or 41 bytes.
That seems to be the combined cost of a single update.
So the overhead is about 20-40 times the cost of the update (I think that for the empty bits maybe those are the 1byte ones?)
So if there were like 60 updates in a second, that could be 100kb a second, a megabyte of savings in just 10 seconds.
But what it would also do is potentially, if left unstaggered, make for larger network jobs at the same time, spiking the CPU, which is not idealx