import { assertReadFromEnv } from "@/lib/utils";
import { getSidekickApi } from "@covenant/sidekick/web";


// change this if you want sidekick to run on a different port
const port = 8008;


const secret = assertReadFromEnv("SIDEKICK_SECRET");
const app = getSidekickApi(secret);


app.listen(port, () => {
  console.log(`Sidekick listening on port ${port}`); 
});
