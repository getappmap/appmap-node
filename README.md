# appmap-node

Experimental AppMap agent for Node.js. Still in active development.

## Usage

Simply use `appmap-node` in place of `node` command, or prepend `appmap-node` 
to your tool invocation:

    $ npx appmap-node foo.js
    $ npx appmap-node yarn jest
    $ npx appmap-node npx ts-node foo.ts

## Configuration

You can create `appmap.yml` config file; if not found, a default one will be created:

```yaml
name: application-name  # from package.json by default
appmap_dir: tmp/appmap
packages:
- path: .  # paths to instrument, relative to appmap.yml location
  exclude:  # code to exclude from instrumentation
  - node_modules  # these paths are excluded by default
  - .yaml  # if you create your own config file, you probably want to add them too
  # You can also exclude methods and functions by name:
  # - functionName
  # - Klass.method
```

## Limitations

This is an experimetal rewrite of the original appmap-agent-js. It's still in active
development, not ready for production use, and the feature set is currently limited.

- Node 18+ supported.
- Only captures named `function`s and methods.
- Http server capture works with node:http, express.js and nest.js (with express.js only).
