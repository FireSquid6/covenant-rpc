

export function assertReadFromEnv(key: string) {
  const value = process.env[key];

  if (value === undefined) {
    console.log(process.env);
    throw new Error(`${key} not defined in env`);
  }

  return value;
}
