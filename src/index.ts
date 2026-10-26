import Watcher from "watcher";
import express from "express";
import attachReload from "reload";
import fs from "node:fs/promises";
import path from "node:path";

type WatcherContstructor = ConstructorParameters<typeof Watcher>;

export interface Change {
  filePath: string;
  operation:
    | "add"
    | "addDir"
    | "change"
    | "rename"
    | "renameDir"
    | "unlink"
    | "unlinkDir";
}

export interface Options {
  buildFunction: (change: Change) => Promise<void>;
  pubDir?: string;
  srcDir?: string | string[];
  server?: {
    port?: number;
    callback?: (error?: Error | undefined) => void;
  };
  watcher?: {
    handler?: WatcherContstructor[2];
    options?: Exclude<WatcherContstructor[1], WatcherContstructor[2]>;
    target?: Exclude<WatcherContstructor[0], WatcherContstructor[2]>;
  };
}

/* watchBuildServeReload
 *
 * Hands of dev server without a build system
 *
 * express + reload should allow us to avoid bringing in a whole other file watcher strategy
 * live-server needs a directory to watch but we just want to watch a src, run a build script, then trigger a reload.
 * if we think the file is html a reload script will be injected.
 **/
export default function watchBuildServeReload(options: Options) {
  // makes src and watcher optional with a default value
  const target =
    options.watcher?.target ??
    options.watcher?.handler ??
    options.srcDir ??
    "./src";

  const config: Exclude<WatcherContstructor[1], WatcherContstructor[2]> = {
    ignoreInitial: true, // to me this is more intuitive as it triggers a change on any file it hits if not ignoring initial, meaning a load could trigger many builds, but also I'm lazy and using the all event
    ...options.watcher?.options,
  };

  const watcher = new Watcher(target, config, options.watcher?.handler);

  if (!watcher) {
    throw new Error("cannot proceed without a watcher");
  }

  watcher.on("error", (error) => {
    console.log(error);
  });

  watcher.on("close", () => {
    console.log("Watcher stopped watching");
  });

  // no need to start web server before we have built the src once, and this should be the signal to watch
  watcher.on("ready", async () => {
    console.log("ready, triggering first build");
    await options.buildFunction({
      filePath: "",
      operation: "add",
      // reloadScript: '<script src="/reload/reload.js"></script>',
    });
    console.log("built, setting up server");

    const app = express();
    const reload = await attachReload(app);
    const base = resolveBaseDir(options.pubDir);

    // resolve the index.html file
    app.get("/", async (_req, res) => {
      const indexPath = path.resolve(base, "index.html");
      try {
        const file = await loadFile(indexPath);
        if (file === null) {
          res.status(404).send(`could not find ${indexPath}`);
        } else {
          res.send(file);
        }
      } catch (reason: unknown) {
        res.status(500).send("unable to load index file at " + indexPath);
      }
    });

    app.get("/*file", async (req, res) => {
      const fullPath = path.resolve(base, ...req.params.file);
      try {
        const file = await loadFile(fullPath);
        if (file === null) {
          res.status(404).send(`could not find ${fullPath}`);
        } else {
          res.setHeader(
            "Content-Type",
            `text/${(path.extname(fullPath) || ".html").slice(1)}`,
          );
          res.send(file);
        }
      } catch (reason: unknown) {
        res.status(500).send("unable to load file at " + fullPath);
      }
    });

    watcher.on("all", async (event, targetPath, targetPathNext) => {
      console.log(`[${event}] ${targetPath} modified, rebuilding`);
      await options.buildFunction({
        filePath: targetPathNext ?? targetPath,
        operation: event,
        // reloadScript: '<script src="/reload/reload.js"></script>',
      });
      console.log("rebuilt, reloading");
      reload.reload();
    });

    const port = options.server?.port ?? 1337;
    app.listen(port, (error) => {
      console.log("Web server up");
      console.log(`http://localhost:${port}`);
      options.server?.callback?.(error);
    });
  });
}

function resolveBaseDir(pubDir?: string) {
  if (pubDir && pubDir.startsWith("./")) {
    return path.resolve(process.cwd(), pubDir);
  } else if (pubDir && pubDir.startsWith("/")) {
    return path.resolve(process.cwd(), path.relative(process.cwd(), pubDir));
  }
  return path.resolve(process.cwd(), "public");
}

async function loadFile(path: string) {
  let content = "";
  try {
    console.log(`loading ${path}`);
    content = await fs.readFile(path, "utf-8");
  } catch (reason: unknown) {
    console.log(`failed to load: ${reason}`);
    return null;
  }
  if (content === "") {
    return null;
  }
  if (path.endsWith(".html")) {
    return content.replace(
      "</body>",
      '<script src="/reload/reload.js"></script></body>',
    );
  }
  return content;
}
