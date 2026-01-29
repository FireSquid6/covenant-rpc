

There needs to be several examples for covenant:
- covenant hello world - a simple hello world app built with covenant. This should just have one "hello world" procedure that you can use that displays on a website
- covenant to do - a simple to do application. This should use sidekick and the listenedQuery feature
- covenant chat - a realtime chat application like discord. Users should be able to create servers, channels within those servers, and send messages. Messages should be realtime

All of these should be built with the following stack:
- bun
- next js
- react
- drizzle orm
- SQLite (use a local file and bun's driver)

For authentication, you can write a simple and insecure username/password authentication. Authentication is not the point of this exercise. We will later create examples that use auth.

Additionally, all of these should be fully tested. Use playwright for UI testing and bun's test driver. 

You will need to flesh out all of these and come up with a plan for each. Start by doing hello world. Come up with a plan and spawn a subagent to complete it. Once that subagent is done, create another plan for the next example. If the subagent runs into any issues with covenant itself, it should stop what its doing and report the issue. Don't fix it yet, summarize it and wait for me. If the subagent successfully completes the example, it should summarize how it solved core problems. 

Once you're done, write `examples/CLAUDE-EXAMPLE.md` as a useful template CLAUDE file for any agent using covenant. 

