# Watch, Build, Serve, Reload

I found myself in need of a live-server I could hook into, and created this.
It uses [watcher](https://www.npmjs.com/package/watcher) to track changes in a src directory, and on startup + changes it calls the supplied build function.
It then sets up an express web server configured with [reload](https://www.npmjs.com/package/reload) and express.static, to serve the web app.

## Usage

It falls back to some defaults so it shouldn't be hard to configure, in its simplest form this should be enough:

```ts
import watchBuildServeReload from "watch-build-serve-reload";

const { app, watcher } = watchBuildServeReload({
  buildFunction: () =>
    new Promise<void>((resolve) =>
      /* do anything you want here, like building your website */ resolve(),
    ),
});
```

It tries to watch `./src` for code, and `./public` for the servable files, and should hopefully crash if they are not reachable.
To get reloading to work we need a script on the client and we do that by injecting a script into any html file that is served:

```ts
content.replace("</body>", '<script src="/reload/reload.js"></script></body>');
```

So to get this to work your html files needs an ending body tag.

## Config

The only required config for this module is the build function, it does not know how to build your code and does not want to know, it only needs to know when it is done, hence the promise.
But some times we need to configure stuff to get it to work, so here is an example with some config.

```ts
import watchBuildServeReload from "watch-build-serve-reload";

async function buildFunction() { … }

const { app, watcher } = watchBuildServeReload({
  buildFunction,
  pubDir: "./www", // where the built website is located, defaults to "./public"
  srcDir: "./files", // the folder watcher should keep track of, defaults to "./src"
  server: {
    callback: () => { console.log("ready to serve") }, // this will be called after the log messages with the url, so only use if you need to hook into here.
    port: 8080, // if you want to chose a port yourself
  },
  watcher: {
    options: {}, // watcher module options
    target: ["./files", "./extra-files"], // this is the same as srcDir, only if it is set it will use this, accepts the same `string | string[]`
  }
});
```
