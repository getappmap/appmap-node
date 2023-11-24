# appmap-node

Experimental AppMap agent for Node.js. Still in active development.

## Usage

Simply use `appmap-node` in place of `node` command, or prepend `appmap-node` 
to your tool invocation:

    $ npx appmap-node foo.js
    $ npx appmap-node yarn jest
    $ npx appmap-node npx ts-node foo.ts

## Configuration

Currently there is no configurability.

## Limitations

This is an experimetal rewrite of the original appmap-agent-js. It's still in active
development, not ready for production use,  and the feature set is currently limited.

- Node 18+ supported.
- Instruments all the files under current directory that aren't node_modules.
- Only captures named `function`s and methods.
- Only whole process recording and Jest, mocha, vitest per-test recordings.
