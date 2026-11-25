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
# Longer parameter and return values are truncated; 0 means no limit.
# Can also be set with the APPMAP_VALUE_MAX_LENGTH environment variable.
# value_max_length: 1024
```
