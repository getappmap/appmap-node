To recreate index.js, index.js.map, index-esm.mjs and index-esm.mjs.map:

```
$ yarn esbuild original.mjs --bundle --platform=node --sourcemap --outfile=built/index.js
$ yarn esbuild original.mjs --bundle --platform=node --sourcemap --outfile=built/index-esm.mjs --format=esm
```