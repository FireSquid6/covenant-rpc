**🚧 Covenant is currently under construction and not production ready. Expect bugs and breaking changes. 🚧**

# Covenant

Covenant RPC is the final solution for querying your backend from your frontend. It provides simple ways to query and mutate data. It's optimized to be vibe coding ready with design intended to minimize AI (and human!) context overload by aggressively separating frontend and backend concerns. You could have separate agents working on the frontend and backend working in perfect harmony without having to waste context on reading any specific implementation details other than the covenant itself.

Covenant also provides an incredibly simple way to do realtime subscriptions and bidirectional communication without leaving the edge by using `Sidekick`. More information on `sidekick` will be published as it is closer to being done.

# Quick Start

## Installation
Covenant currently only supports typescript projects and is built to work best with bun.

```bash
# pick your favorite:

npm install @covenant/rpc
pnpm install @covenant/rpc
bun add @covenant/rpc
```


## Server Setup

Start by defining your covenant. This is all of the functions your frontend can call from your backend. This module should remain isolated from the rest of your code (although I use the database schema here, which is fine since drizzle isolates that file).

```ts
import { z } from "zod";
import { declareCovenant, query, mutation } from "@covenant/rpc";
import { todosSelectSchema } from "@/db/schema";


export const covenant = declareCovenant({
    channels: {},
    procedures: {
        hello: query({
            input: z.object({
                name: z.string(),
            }),
            output: z.object({
                message: z.string(),
            })
        })

    },
})
```

You can use any validation library you'd like that implements [Standard Schema](https://github.com/standard-schema/standard-schema). In this example I am using zod, but you could also use arctype or even mix and match.


Now, define your server in another file. You can use the `contextGenerator` to attach data like the user making the request to each procedure, and use the `derivation` to provide useful functions to your procedures.

```ts
import { db } from "@/db";
import { getUserAndSession } from "@/db/user";
import { covenant } from "@/lib/covenant";
import { CovenantServer } from "@covenant/rpc/server";
import { emptyServerToSidekick } from "@covenant/rpc/interfaces/empty";
import type { User } from "@/db/schema";


export const covenantServer = new CovenantServer(
    covenant,
    {
        // sidekick connection left empty for this simple demo. Sidekick
        // is used for realtime channels and remote resource listening
        sidekickConnection: emptyServerToSidekick(),
        contextGenerator: async () => {
            // replace `getUserAndSesssion` with whatever your actual
            const auth = await getUserAndSession(db);
            return {
                // could be null
                user: auth.user,
            }
        },
        derivation: ({ error, ctx }) => {
            return {
                forceAuthenticated: async (): Promise<User> => {
                    const user = ctx.user;

                    if (!user) {
                        // throwing an error like this is how we "return early" from a function
                        throw error("Not authenticated", 401);
                    }

                    return user;
                },
            }
        },
    }
)


// when you have a lot of procedures, it can be best to move the definitions to multiple files
// and call a function to define each one
covenantServer.defineProcedure("hello", {
    // the resources is used by remote listeners to know when to refetch
    // see the docs on remote listeners for more info
    resources: ({ inputs }) => {
        return [`greeting/${inputs.name}`];
    },
    // this is the actual function that's run to query hello
    procedure: ({ inputs, derivation: { forceAuthenticated } }) => {
        // user is typed to be not null here. The procedure will
        // return early if the user is failed to be logged in
        const user = forceAuthenticated();

        return {
            message: `${user.username} says: hello, ${inputs.name}`
        }
    },
});


// makes sure that we can't forget a definition
covenantServer.assertAllDefined();
```


Then, you want to hook up your server to some route. Here's how it would be done in Next.js:

```ts
// file: app/api/covenant/route.ts
import { covenantServer } from "@/lib/server";
import { vanillaAdapter } from "@covenant/rpc/adapters/vanilla";


// takes in a Request, returns a Response 
const handler = vanillaAdapter(covenantServer);

export { handler as GET, handler as POST }; 
```


## Frontend Setup

Now create the client on the frontend:

```ts
import { CovenantClient } from "@covenant/rpc/client";
import { covenant } from "./covenant";
import { httpClientToServer } from "@covenant/rpc/interfaces/http";
import { emptyClientToSidekick } from "@covenant/rpc/interfaces/empty";


export const covenantClient = new CovenantClient(covenant, {
    // maybe smart to use an environment variable here to use a different url in production
    //
    // second arg is any headers you would like to attach to every request. This is useful
    // if you're doing bearer token authentication
    serverConnection: httpClientToServer("http://localhost:3000/api/covenant", {}),

    // sidekick is unnecessary for this example. If included, it would allow for realtime
    // communication
    sidekickConnection: emptyClientToSidekick()
});
```

You can then call procedures anywhere in your frontend code:

```ts
import { covenantClient } from "@/lib/client";

export function sayHello(to: string) {
    // autocomplete is given for the query name and arguments
    const { data, error, success } = await covenantClient.query("hello", {
        name: to,
    });

    if (success) {
        console.log(data.message);
        //           ^ typed as: { message: string } since success is true
    } else {
        console.error(`Error: ${error.code} - ${error.message}`);
    }
}
```

## React
TODO - react and other frontend specific query libraries. For now, you'll just have to write your own hooks. Expect `@covenant/react` to be in the works and finished first, with `@covenant/vue`, `@covenant/svelte` and others coming after (although I am not an expert any either vue or svelte so if you are help would be greatly appreciated).

# Documentation
Covenant is still very much in the oven so documentation is still not up. If you're interested in helping out development, email `me@jdeiss.com`.

# Current Pain Points

- Drizzle ORM sucks to use with covenant. It ends up messing up the validation with dates.

