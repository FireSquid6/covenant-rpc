import { createCommand } from "@commander-js/extra-typings";


function prettyFatal(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function forceReadFromEnv(key: string, extra?: string): string {
  const val = process.env[key];

  if (val === undefined) {
    console.error(`Error: could not find ${key} in the environment ${extra ?? ""}`);
    process.exit(1);
  }

  return val;
}

const program = createCommand()


program
  .command("start", "Starts the sidekick server")
  .option("-p, --port <port>", "The port to start on")
  .option("-s, --secret <port>", "The s")
  .action((opts, args) => {
    const port = !opts.port ? 8008 : parseInt(opts.port);

    if (isNaN(port)) {
      prettyFatal(`Port ${opts.port} could not be parsed as a number`);
    }

    const secret = opts.secret === undefined 
      ? forceReadFromEnv("SIDEKICK_SECRET", "Try setting -p or including the env var")
      : opts.secret;

  })



program.parse();
