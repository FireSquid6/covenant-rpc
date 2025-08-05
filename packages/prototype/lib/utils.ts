import fs from "fs";
import path from "path";

export type Flatten<T> = { [k in keyof T ]: T[k] } & {};

const validFileExtensions = [".ts", ".js", ".tsx", ".jsx"];

export async function callDefaultsInDirectory(directory: string) {
  const subpaths = fs.readdirSync(directory, { recursive: true });


  await Promise.all(subpaths.map(async (p) => {
    const filepath = path.join(directory, p.toString());
    const extension = path.extname(filepath);

    if (validFileExtensions.find(f => f === extension) === undefined) {
      console.log(`${filepath} is not a source file`);
      return;
    }
    try {
      const mod = await import(filepath);
      mod.default();
    } catch (e) {
      console.log(`${filepath} had error:`);
      console.log(e);
      return;
    }
    console.log(`${filepath} was run`);
  }))
}
