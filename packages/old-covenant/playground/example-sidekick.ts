import { getSidekick } from "sidekick/server";




const app = getSidekick({
  covenantSecret: "secret",
  covenantEndpoint: "http://localhost:5001/api",
});


app.listen(5002, () => {
  console.log(`Sidekick listening on port 5002`);
})
