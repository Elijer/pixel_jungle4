# Why add optimistic updates (OU)?
So far it looks like in the deployment some amount of traffic is handled alright, but the latency is not great.
I kind of want to tackle the latency.

Other things I might want to do before tackling this:
- It might just make more sense to just finish the gameplay - you know, why make it perfect before finishing the gameplay?
- I might also want to stress test the server a bit better: there could be other performance issues - I may be able to do this with artillery. Would knowing the server can handle more traffic help me though

To make this clear - this is scope creep. This is also basically what happens EVERY time I have made this game. There is some latency. Many, many games use optimistic updating, so I think as a solution it makes a lot of sense. It would also be really fun and should be doable, but it might be tricky as well.

I think the main question is, should I work on OU before finishing the game functionality? And I think the answer is no. Last night I went a bit cowboy - I deployed, creating some playwright tests, and it all went really well. I'd like to keep that momentum by actually finishing the game.