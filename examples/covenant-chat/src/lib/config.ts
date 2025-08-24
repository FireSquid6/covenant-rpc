export interface AppConfig {
  dbType: "local" | "remote";
  dbPath: string;
  dbToken: string | undefined;
  jwtKey: string;
  githubClientId: string;
  githubClientSecret: string;
}



export function readConfigFromEnv(): AppConfig {
  const clientId = process.env.GITHUB_ID;
  const clientSecret = process.env.GITHUB_SECRET;

  if (clientId === undefined) {
    throw new Error("No GITHUB_ID provided");
  }

  if (clientSecret === undefined) {
    throw new Error("No GITHUB_SECRET provided");
  }

  return {
    dbType: process.env.DB_TYPE === "remote" ? "remote" : "local",
    dbPath: process.env.DB_PATH ?? "localdb/db.sqlite",
    dbToken: process.env.DB_TOKEN,
    jwtKey: process.env.JWT_KEY ?? "a-string-secret-at-least-256-bits-long",
    githubClientId: clientId,
    githubClientSecret: clientSecret,
  }
}
