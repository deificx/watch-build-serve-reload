import watchBuildServeReload, { type Change } from "../src/index.ts";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

watchBuildServeReload({
  buildFunction,
  pubDir: path.resolve(__dirname, "public"),
  srcDir: path.resolve(__dirname, "src"),
});

async function mkDir(dest: string) {
  try {
    await fs.mkdir(dest);
  } catch {
    // assume it exist
  }
}

async function buildFunction(change: Change) {
  const src = path.resolve(__dirname, "src");
  const dest = path.resolve(__dirname, "public");
  await mkDir(dest);
  const files = change.filePath
    ? [path.relative(src, change.filePath)]
    : await fs.readdir(src);
  await Promise.all(
    files.map(async (file) => {
      const a = path.resolve(src, file);
      const b = path.resolve(dest, file);
      console.log(
        JSON.stringify(
          {
            a,
            b,
            file,
          },
          null,
          2,
        ),
      );
      return fs.copyFile(a, b).finally(() => {
        console.log(`copied ${a} to ${b}`);
      });
    }),
  );
}
