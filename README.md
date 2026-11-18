# appmap-node

AppMap agent for Node.js.

See the [official documentation](https://appmap.io/docs/reference/appmap-node.html) for full reference.

## Usage

Simply use `appmap-node` in place of `node` command, or prepend `appmap-node` 
to your tool invocation:

    $ npx appmap-node foo.js
    $ npx appmap-node yarn jest
    $ npx appmap-node yarn vitest run
    $ npx appmap-node npx ts-node foo.ts

## Code Block Recording

You can run appmap-node and use the exposed API to record snippets
of interest.

    $ npx appmap-node foo.js

foo.js
```JavaScript
const { record } = require("appmap-node");

const appmap = record(() => {
  hello("world");
});
// You can consume the details of the appmap object
console.log("# of events: ", appmap?.events.length);
```

## Configuration

You can create `appmap.yml` config file; if not found, a default one will be created:

```yaml
name: application-name  # from package.json by default
appmap_dir: tmp/appmap
language: javascript
packages:
- path: .  # paths to instrument, relative to appmap.yml location
  exclude:  # code to exclude from instrumentation
  - node_modules  # these paths are excluded by default
  - .yaml  # if you create your own config file, you probably want to add them too
  # You can also exclude methods and functions by name:
  # - functionName
  # - Klass.method
```

### Async tracking timeout

Node runs many asynchronous calls interleaved on a single thread, while an
AppMap records calls nested in the order they happen. To keep everything an
async call does (eg. a request handler awaiting a database query) nested inside
it, appmap-node holds back the events that come after the call until it's
done. It won't wait forever though: if an async call takes longer than
`async_tracking_timeout` milliseconds (3000 by default), the events held back
are written out, and whatever the call does from then on is recorded outside
of it. The recording stays consistent, but those events show up in the wrong
place, and appmap-node prints a message the first time this happens.

If your code legitimately takes longer than that (eg. the first request in
`next dev`, which compiles the page), you can raise the timeout in
`appmap.yml`:

```yaml
async_tracking_timeout: 30000
```

or with the `APPMAP_ASYNC_TRACKING_TIMEOUT` environment variable. A longer
timeout costs memory, since everything that happens meanwhile is held back,
and long-lived requests such as server-sent event streams will then hold up
writing for longer. Setting it to `0` disables async tracking altogether:
events are written in the order they happen, without regard to nesting.
