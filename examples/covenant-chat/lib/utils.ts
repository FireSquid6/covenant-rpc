

export function assertReadFromEnv(key: string) {
  const value = process.env[key];

  if (value === undefined) {
    throw new Error(`${key} not defined in env`);
  }

  return value;
}
