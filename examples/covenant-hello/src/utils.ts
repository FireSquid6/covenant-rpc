


export function assertEnvVar(k: string): string {
  const value = process.env[k];

  if (value === undefined) {
    throw new Error(`${k} was asserted to exist but was not found in env`);
  }

  return value;
}
