To recreate index.js & index.js.map:

```
$ yarn esbuild original.mjs --bundle --platform=node --sourcemap --outfile=built/index.js
```