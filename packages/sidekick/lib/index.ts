import { getSidekickApi } from "./web";


export function startSidekick(opts: { secret: string, port: number }) {
  const api = getSidekickApi(opts.secret);

  api.listen(opts.port, () => {
    console.log(`Sidekick listening on port ${opts.port}`);
  });
}
