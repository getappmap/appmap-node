## [2.23.1](https://github.com/getappmap/appmap-node/compare/v2.23.0...v2.23.1) (2024-07-23)


### Bug Fixes

* Don't use blocking fs function in remote recording finish ([40bcd0c](https://github.com/getappmap/appmap-node/commit/40bcd0cd4c914f66fe88ca7a311f9f7521059933))

# [2.23.0](https://github.com/getappmap/appmap-node/compare/v2.22.0...v2.23.0) (2024-05-22)


### Features

* Add `language` to appmap.yml ([a9f37b3](https://github.com/getappmap/appmap-node/commit/a9f37b386b56af6c84a8ef08f2328d48d4d7a9c7))

# [2.22.0](https://github.com/getappmap/appmap-node/compare/v2.21.1...v2.22.0) (2024-05-20)


### Features

* Extract function labels from code comments ([4984bcc](https://github.com/getappmap/appmap-node/commit/4984bcc7959a9cace037ed6e0624efbc8d4e00bd))
* Function labels in appmap.yml config file ([4a96f4c](https://github.com/getappmap/appmap-node/commit/4a96f4c8c7951cf2493bcb397003e733392f3532))
* Instrument calls to libraries ([41762ed](https://github.com/getappmap/appmap-node/commit/41762edb05dbf7dec79894869bb531a4cd35d732))
* Instrument calls to libraries - ESM support ([42edc26](https://github.com/getappmap/appmap-node/commit/42edc264b5b8ddce42f2e7c77872cee9acd41322))

## [2.21.1](https://github.com/getappmap/appmap-node/compare/v2.21.0...v2.21.1) (2024-05-06)


### Bug Fixes

* Check if recording are still active in callbacks ([dea07a9](https://github.com/getappmap/appmap-node/commit/dea07a9d07c68cccc170b42724cbea335c74a868))
* Check if recordings are still active after promise resolution ([b40988a](https://github.com/getappmap/appmap-node/commit/b40988a7c9f1d8b9fd48dad94a9105621eac99b9))

# [2.21.0](https://github.com/getappmap/appmap-node/compare/v2.20.0...v2.21.0) (2024-04-24)


### Bug Fixes

* Extended client sql recording and repeated calls in Prisma ([2cee1a9](https://github.com/getappmap/appmap-node/commit/2cee1a95b761ecce6674a1129ddd503fea6e364e))
* Report test source location (file only) - Jest ([57774d1](https://github.com/getappmap/appmap-node/commit/57774d10f26c8c56554a235399949f4ae0d59e40))
* Report test source location (file only) - Mocha ([d97aaa9](https://github.com/getappmap/appmap-node/commit/d97aaa9966807ed34367902619c40487c119cb21))
* Report test source location (file only) - Vitest ([8da1260](https://github.com/getappmap/appmap-node/commit/8da1260d5cd777512fd4431545e7672393455b30))
* Request recording abandons test recording ([2955331](https://github.com/getappmap/appmap-node/commit/2955331b4ef8c59ae65df7e35438a767e42d7126))


### Features

* Multiple recording support (process always active) ([d47afff](https://github.com/getappmap/appmap-node/commit/d47afff15d9bfbcdb3b89870e6a91c2594c7f1d7))

# [2.20.0](https://github.com/getappmap/appmap-node/compare/v2.19.3...v2.20.0) (2024-04-19)


### Bug Fixes

* Disable stray debugging output ([7b7841e](https://github.com/getappmap/appmap-node/commit/7b7841ec75a3464315b495b18af6d8e017ff2c95))


### Features

* Code block recording ([9e1048a](https://github.com/getappmap/appmap-node/commit/9e1048aec18abce164540de1c8bec8d0ca31b7aa))

## [2.19.3](https://github.com/getappmap/appmap-node/compare/v2.19.2...v2.19.3) (2024-04-03)


### Bug Fixes

* Don't replace malformed appmap.yml ([48df24c](https://github.com/getappmap/appmap-node/commit/48df24cedd5b89a92429608d5a97ae8de3361c25))

## [2.19.2](https://github.com/getappmap/appmap-node/compare/v2.19.1...v2.19.2) (2024-03-27)


### Bug Fixes

* Replace special characters in paths consistently on all platforms ([c06fa30](https://github.com/getappmap/appmap-node/commit/c06fa300182acdf448f74a5c97c3f2c30b3ea7dd)), closes [#134](https://github.com/getappmap/appmap-node/issues/134)

## [2.19.1](https://github.com/getappmap/appmap-node/compare/v2.19.0...v2.19.1) (2024-03-23)


### Bug Fixes

* Instrumented async lambda wrapper should be async ([720b39b](https://github.com/getappmap/appmap-node/commit/720b39bba616328ddb821842449fe53b026ac6e7))

# [2.19.0](https://github.com/getappmap/appmap-node/compare/v2.18.0...v2.19.0) (2024-03-19)


### Bug Fixes

* Correctly quote NODE_OPTIONS when spaces occur in paths ([36b5c9e](https://github.com/getappmap/appmap-node/commit/36b5c9e264ca58541510a6471d62688850b9d99c)), closes [#122](https://github.com/getappmap/appmap-node/issues/122)


### Features

* Instrument named const and exported lambdas ([4ec7754](https://github.com/getappmap/appmap-node/commit/4ec77545613568050a8484d26c4885c8f088ce2d))
* Stringify ClientRequests as `[ClientRequest: <method> <url>]` ([f4b8518](https://github.com/getappmap/appmap-node/commit/f4b8518dbdacdd68e0bb9a0bf14b6797450e7cf8))

# [2.18.0](https://github.com/getappmap/appmap-node/compare/v2.17.0...v2.18.0) (2024-03-03)


### Features

* Capture response body ([b939b95](https://github.com/getappmap/appmap-node/commit/b939b953ae19257e18ca9c54910c0aa0c6a2bf32))

# [2.17.0](https://github.com/getappmap/appmap-node/compare/v2.16.1...v2.17.0) (2024-03-01)


### Features

* Support MongoDB ([10b65d6](https://github.com/getappmap/appmap-node/commit/10b65d64779f2176be55b1705b425e7e6b3b9bc7)), closes [#106](https://github.com/getappmap/appmap-node/issues/106)

## [2.16.1](https://github.com/getappmap/appmap-node/compare/v2.16.0...v2.16.1) (2024-03-01)


### Bug Fixes

* Properly parse tsconfig.json ([2a1f409](https://github.com/getappmap/appmap-node/commit/2a1f4093c6091e1a30ee7396baed07698bbba789))

# [2.16.0](https://github.com/getappmap/appmap-node/compare/v2.15.0...v2.16.0) (2024-02-27)


### Features

* Prisma support ([93242e1](https://github.com/getappmap/appmap-node/commit/93242e18343d62c98976ca0cc417bda9890886e7))

# [2.15.0](https://github.com/getappmap/appmap-node/compare/v2.14.2...v2.15.0) (2024-02-07)


### Bug Fixes

* Correctly handle dots in paths ([7168e56](https://github.com/getappmap/appmap-node/commit/7168e56bdb564fc8b62fcc7ce87478aaa307dcc4)), closes [#104](https://github.com/getappmap/appmap-node/issues/104)
* Handle relative paths in source maps correctly ([a35df7e](https://github.com/getappmap/appmap-node/commit/a35df7ef134260e3b630637b0023abbae2d9cbbe))
* Handle tRPC proxy error in object constructor access ([c0b53dd](https://github.com/getappmap/appmap-node/commit/c0b53dda727164c9fc7859722b2c06a109efe577))
* Skip transformation for next edge runtime ([9997353](https://github.com/getappmap/appmap-node/commit/9997353faf38823606bc60e9004a1bcd9d90122d))


### Features

* Use relative paths in appmaps ([62105e3](https://github.com/getappmap/appmap-node/commit/62105e3d1dd80f114d8f98985dc07bed457148af)), closes [#100](https://github.com/getappmap/appmap-node/issues/100)

## [2.14.2](https://github.com/getappmap/appmap-node/compare/v2.14.1...v2.14.2) (2024-01-25)


### Bug Fixes

* Stack overflow in circularly referenced parameter objects ([5886b63](https://github.com/getappmap/appmap-node/commit/5886b63442b397d9e37af20fc41764d91b28264d))

## [2.14.1](https://github.com/getappmap/appmap-node/compare/v2.14.0...v2.14.1) (2024-01-24)


### Bug Fixes

* Handle external source maps ([01d9a09](https://github.com/getappmap/appmap-node/commit/01d9a09043f065ef2ea63b2fcb20f8d154688b55)), closes [#96](https://github.com/getappmap/appmap-node/issues/96)

# [2.14.0](https://github.com/getappmap/appmap-node/compare/v2.13.2...v2.14.0) (2024-01-24)


### Bug Fixes

* Hook next with a webpack instead of hooking swc ([9b44adf](https://github.com/getappmap/appmap-node/commit/9b44adf062d54ac996e9cb6c081a00dcc3b742ae)), closes [#76](https://github.com/getappmap/appmap-node/issues/76)
* Windows support ([#89](https://github.com/getappmap/appmap-node/issues/89)) ([7d88965](https://github.com/getappmap/appmap-node/commit/7d88965fe5f7f204d04462a3b716904fb363e672))


### Features

* Packages in the classmap now model directories exclusively ([0786a48](https://github.com/getappmap/appmap-node/commit/0786a4862d860a4cf32dd801e002948a5520f969)), closes [#93](https://github.com/getappmap/appmap-node/issues/93)
* Replace spaces in filenames with underscores ([734a5eb](https://github.com/getappmap/appmap-node/commit/734a5eba1b46517ec28cd3c04e6ab1b4dd85372f)), closes [#94](https://github.com/getappmap/appmap-node/issues/94)

## [2.13.2](https://github.com/getappmap/appmap-node/compare/v2.13.1...v2.13.2) (2024-01-15)


### Bug Fixes

* Don't use custom inspect implementations when stringifying ([a0fc800](https://github.com/getappmap/appmap-node/commit/a0fc8006aace9848be77d7a5736908b54a79efde)), closes [#75](https://github.com/getappmap/appmap-node/issues/75)

## [2.13.1](https://github.com/getappmap/appmap-node/compare/v2.13.0...v2.13.1) (2024-01-13)


### Bug Fixes

* Remove typescript runtime dependency ([b7dcb28](https://github.com/getappmap/appmap-node/commit/b7dcb28ac726f1be77a2b08641ae612b7bc12409))

# [2.13.0](https://github.com/getappmap/appmap-node/compare/v2.12.1...v2.13.0) (2024-01-12)


### Features

* Http capture support in ESM ([3d5cd6d](https://github.com/getappmap/appmap-node/commit/3d5cd6d6c2f59b5cea8827f08705348acc9371d3))

## [2.12.1](https://github.com/getappmap/appmap-node/compare/v2.12.0...v2.12.1) (2024-01-12)


### Bug Fixes

* Add '--loader ts-node/esm' node options if esm: true in tsconfig.json ([1f2438b](https://github.com/getappmap/appmap-node/commit/1f2438bf8766276c65a56245d9473e59f0a6291a))

# [2.12.0](https://github.com/getappmap/appmap-node/compare/v2.11.0...v2.12.0) (2024-01-10)


### Bug Fixes

* Make sure AppMap root stays constant after launch ([1429711](https://github.com/getappmap/appmap-node/commit/14297111df675b8cd9695f10f2f1c161e389ca35))
* Use package.json location as project root ([0bcfe0b](https://github.com/getappmap/appmap-node/commit/0bcfe0b17b7fce8d0e77049de97622e8023937f9))


### Features

* Allow excluding functions by name from instrumentation ([3a9f5ba](https://github.com/getappmap/appmap-node/commit/3a9f5ba227c4d5a75ab4709f6e62b49cb71b78a1))
* Allow specifying instrumented files ([5a2cc29](https://github.com/getappmap/appmap-node/commit/5a2cc290e6cec714e013dcd652a690b362857a90))
* Support a config file ([3fe9a10](https://github.com/getappmap/appmap-node/commit/3fe9a10e0415f289a079f020b7e48c59e4629a5a))
* Write a default config file if none found ([08f3af2](https://github.com/getappmap/appmap-node/commit/08f3af2999e378aa4a4c51b9c212ea404d407219))

# [2.11.0](https://github.com/getappmap/appmap-node/compare/v2.10.0...v2.11.0) (2024-01-10)


### Features

* Next.js support (SWC - v12, v13, v14) ([#71](https://github.com/getappmap/appmap-node/issues/71)) ([a7a0ef6](https://github.com/getappmap/appmap-node/commit/a7a0ef638d4c26e6f26b9deb173571bcb3311a18))

# [2.10.0](https://github.com/getappmap/appmap-node/compare/v2.9.0...v2.10.0) (2023-12-21)


### Features

* Write AppMaps atomically ([947df8f](https://github.com/getappmap/appmap-node/commit/947df8fd54005e772acf75a8251e73029eb54897))

# [2.9.0](https://github.com/getappmap/appmap-node/compare/v2.8.1...v2.9.0) (2023-12-20)


### Bug Fixes

* Handle rejected promises ([8507ede](https://github.com/getappmap/appmap-node/commit/8507ede36c1c39458a95cae4278986607bbe2c87))


### Features

* Encode resolved promise type in return_value.class ([7a17bed](https://github.com/getappmap/appmap-node/commit/7a17bedada58ac25c3d43dbfe816fc941169b60b))

## [2.8.1](https://github.com/getappmap/appmap-node/compare/v2.8.0...v2.8.1) (2023-12-18)


### Bug Fixes

* Double sql recording in PostgreSQL ([ea29f64](https://github.com/getappmap/appmap-node/commit/ea29f643820efee5666d5b9b3103fc408ebb2de7))

# [2.8.0](https://github.com/getappmap/appmap-node/compare/v2.7.4...v2.8.0) (2023-12-18)


### Features

* Remote recording ([2e5bea7](https://github.com/getappmap/appmap-node/commit/2e5bea76684a9366e6287c5544730aad33124414)), closes [#42](https://github.com/getappmap/appmap-node/issues/42)

## [2.7.4](https://github.com/getappmap/appmap-node/compare/v2.7.3...v2.7.4) (2023-12-13)


### Bug Fixes

* Apply extension-less workaround regardless of Node version ([430725a](https://github.com/getappmap/appmap-node/commit/430725ab3410f22523db86e8efe68f58b53368c8))
* Fill in defined_class field even for free functions ([edf9247](https://github.com/getappmap/appmap-node/commit/edf924799fd8b89e8cb71e838dd206b8b2a539dd))

## [2.7.3](https://github.com/getappmap/appmap-node/compare/v2.7.2...v2.7.3) (2023-12-11)


### Bug Fixes

* Support Jest version 27 ([cf710c0](https://github.com/getappmap/appmap-node/commit/cf710c0ea436f6aca609ca9bb621fcf0c6f2cca9)), closes [#53](https://github.com/getappmap/appmap-node/issues/53)

## [2.7.2](https://github.com/getappmap/appmap-node/compare/v2.7.1...v2.7.2) (2023-12-11)


### Bug Fixes

* Correctly handle timed out tests in Jest ([216c4f1](https://github.com/getappmap/appmap-node/commit/216c4f160d4d4605eb2c250fc64eaaefc569010e)), closes [#46](https://github.com/getappmap/appmap-node/issues/46)
* Handle extension-less files in Node 18 ([1e76555](https://github.com/getappmap/appmap-node/commit/1e76555caeb77d00f60d130f7bdf224cad20e630))

## [2.7.1](https://github.com/getappmap/appmap-node/compare/v2.7.0...v2.7.1) (2023-12-10)


### Bug Fixes

* Avoid infinite recursion when stringifying ([6e38a11](https://github.com/getappmap/appmap-node/commit/6e38a11c259a50bb9df397827a5939c694fbc3f3))
* check recording finished in request hook ([73d993c](https://github.com/getappmap/appmap-node/commit/73d993c34bb670ac9fe0da409ae3433e26a26327))
* Finish recording on SIGINT even without a handler ([5401b46](https://github.com/getappmap/appmap-node/commit/5401b46066fe6b84b76ed2f5d1f56cb541e4131e))

# [2.7.0](https://github.com/getappmap/appmap-node/compare/v2.6.1...v2.7.0) (2023-12-02)


### Features

* Request recordings ([16c78e7](https://github.com/getappmap/appmap-node/commit/16c78e7246f62ddce67d9cc8398e52180c4643c7)), closes [#38](https://github.com/getappmap/appmap-node/issues/38)

## [2.6.1](https://github.com/getappmap/appmap-node/compare/v2.6.0...v2.6.1) (2023-12-01)


### Bug Fixes

* Correct capitalisation of HTTP headers ([4052dea](https://github.com/getappmap/appmap-node/commit/4052deaae0fc9645ad8876b81e08f027799bab2a))
* Handle HTTP requests intercepted by nock ([982f4b1](https://github.com/getappmap/appmap-node/commit/982f4b1e77bbe6d8f9eb3d2ef56f24d6a0ce8c43)), closes [#47](https://github.com/getappmap/appmap-node/issues/47)

# [2.6.0](https://github.com/getappmap/appmap-node/compare/v2.5.1...v2.6.0) (2023-11-28)


### Features

* Support for MySQL ([6edcfd8](https://github.com/getappmap/appmap-node/commit/6edcfd8c7b79e743c9f4e5747a38d7e1b308a85f))

## [2.5.1](https://github.com/getappmap/appmap-node/compare/v2.5.0...v2.5.1) (2023-11-28)


### Bug Fixes

* Support generator functions and skip generator methods ([37c755e](https://github.com/getappmap/appmap-node/commit/37c755e252b1eb40dd74baceac1dfbea5111f594))

# [2.5.0](https://github.com/getappmap/appmap-node/compare/v2.4.0...v2.5.0) (2023-11-25)


### Bug Fixes

* Forward signals to the child when spawning ([52eddd3](https://github.com/getappmap/appmap-node/commit/52eddd3f039a80c3970b5e5521f77acfa3134f26))
* Skip instrumenting .yarn files ([ee88945](https://github.com/getappmap/appmap-node/commit/ee88945bc6e996f23768305db105e45fc1e8b3a2))


### Features

* Capture exceptions ([18d4f48](https://github.com/getappmap/appmap-node/commit/18d4f48f298d47defbdeeb021dbbfc9f7f732223))
* Don't instrument generated code ([eacd5f7](https://github.com/getappmap/appmap-node/commit/eacd5f71e857b782aa60e2b6129df656e8d4b57f))
* Emit metadata.exception in test runs ([84bda66](https://github.com/getappmap/appmap-node/commit/84bda6692314a15a30c2276e0a80b51cbf8f6d80)), closes [#26](https://github.com/getappmap/appmap-node/issues/26)
* Generate object_ids ([2a226a5](https://github.com/getappmap/appmap-node/commit/2a226a565101b273c1e7f76ac32bcc8b6dd26370))

# [2.4.0](https://github.com/getappmap/appmap-node/compare/v2.3.3...v2.4.0) (2023-11-24)


### Features

* Support for SQLite ([52b58a9](https://github.com/getappmap/appmap-node/commit/52b58a9fca87df64067ec002b0786681d570aa39))

## [2.3.3](https://github.com/getappmap/appmap-node/compare/v2.3.2...v2.3.3) (2023-11-24)


### Bug Fixes

* call super constructor ([3cb9f84](https://github.com/getappmap/appmap-node/commit/3cb9f840b49443912a6396ec33cc0729c77e1110))

## [2.3.2](https://github.com/getappmap/appmap-node/compare/v2.3.1...v2.3.2) (2023-11-18)


### Bug Fixes

* Don't crash when examining null prototype objects ([a8af772](https://github.com/getappmap/appmap-node/commit/a8af772bdc1353726ef75e83386fcaa0a07bdda4))
* Use package name as the class name for free functions ([a759081](https://github.com/getappmap/appmap-node/commit/a759081557c44247bd0af59902cbbd866e32eb0b)), closes [#30](https://github.com/getappmap/appmap-node/issues/30) [#29](https://github.com/getappmap/appmap-node/issues/29)

## [2.3.1](https://github.com/getappmap/appmap-node/compare/v2.3.0...v2.3.1) (2023-11-17)


### Bug Fixes

* super keyword unexpected here ([2fa388c](https://github.com/getappmap/appmap-node/commit/2fa388ca065d40302a946306830c528b3bdf0f67))

# [2.3.0](https://github.com/getappmap/appmap-node/compare/v2.2.0...v2.3.0) (2023-11-17)


### Features

* Support for PostgreSQL ([ed68185](https://github.com/getappmap/appmap-node/commit/ed68185e9df74c8c582cc334f2e2a2cbd0408c88))

# [2.2.0](https://github.com/getappmap/appmap-node/compare/v2.1.0...v2.2.0) (2023-11-15)


### Features

* Capture HTTP query parameters ([86fd3e6](https://github.com/getappmap/appmap-node/commit/86fd3e647a25818cdd776035ff8772799dfd0a82))
* Extract normalized routes and parameters in express.js requests ([b756c15](https://github.com/getappmap/appmap-node/commit/b756c156e85f12b98b468e875c3254ed3335fff8))
* Resolve parameter schema for arrays and objects ([967cbbc](https://github.com/getappmap/appmap-node/commit/967cbbcac7353bea7e7362cac20499b082002b1b))

# [2.1.0](https://github.com/getappmap/appmap-node/compare/v2.0.0...v2.1.0) (2023-11-09)


### Features

* Support for mapping HTTP client requests ([55ef2e6](https://github.com/getappmap/appmap-node/commit/55ef2e608550ebfb54cce5051f92a8b5df32e379))

# [2.0.0](https://github.com/getappmap/appmap-node/compare/v1.2.0...v2.0.0) (2023-11-09)


### Bug Fixes

* Drop support for Node 16 ([c6ce5c0](https://github.com/getappmap/appmap-node/commit/c6ce5c07ba4302c6591ab704c9ef238739661493))


### BREAKING CHANGES

* Support for Node 16 has been removed.
(It has been deprecated upstream since 2023-09-11.)

Additionally, testing on Node 21 has been added to the CI pipeline.

# [1.2.0](https://github.com/getappmap/appmap-node/compare/v1.1.1...v1.2.0) (2023-11-07)


### Features

* ESM support ([a5970e7](https://github.com/getappmap/appmap-node/commit/a5970e7c1161c708feb9325ba538ad7e92615af9))
* Support for Vitest ([cfe7deb](https://github.com/getappmap/appmap-node/commit/cfe7debeb0c1c5304df0ee7b837d45e46db20552))

## [1.1.1](https://github.com/getappmap/appmap-node/compare/v1.1.0...v1.1.1) (2023-11-06)


### Bug Fixes

* Use "javascript" as the language name in metadata ([d46522c](https://github.com/getappmap/appmap-node/commit/d46522c0479f664b3aea40c175fbc07ec1924d50))

# [1.1.0](https://github.com/getappmap/appmap-node/compare/v1.0.0...v1.1.0) (2023-10-27)


### Features

* Record HTTP requests and responses (server-side) ([f7c5974](https://github.com/getappmap/appmap-node/commit/f7c5974737e3d9b91881297481fe0493b82a8124))

# 1.0.0 (2023-10-24)


### Bug Fixes

* Only show a summary message when writing several appmaps ([11899be](https://github.com/getappmap/appmap-node/commit/11899bec42fac2cb308f7725d2278989170759ee))


### Features

* Capture per-test recordings in Jest ([74af72f](https://github.com/getappmap/appmap-node/commit/74af72f838030f694b53bdc7cfc47e0df219ee05))
* Capture promise values after they resolve ([a3655c4](https://github.com/getappmap/appmap-node/commit/a3655c4cb3f6459928061d2894823b60ac0caa9f))
* Emit AppMap metadata ([8c6b0fd](https://github.com/getappmap/appmap-node/commit/8c6b0fd4ab41369b48087ba1ea15aeac67ca0cc2))
* Emit class maps in produced AppMaps ([89e1e26](https://github.com/getappmap/appmap-node/commit/89e1e26c2856ac0ef5e299fe0eb2b981be635924))
* Measure elapsed time ([3e976f4](https://github.com/getappmap/appmap-node/commit/3e976f4338d28ebc418443e8756db9b3d369d772))
* Pass the child return code when spawning ([ba71544](https://github.com/getappmap/appmap-node/commit/ba715447ac41dc59a47c640472cb602e7306ab03))
* support for Mocha ([cc6450f](https://github.com/getappmap/appmap-node/commit/cc6450f25a9f694b3581d3ac6543cd8034447bdc))
* Use source maps to emit correct source locations ([a9b35a0](https://github.com/getappmap/appmap-node/commit/a9b35a050264b1dd1fbda228ff52b48a637fe5f6))
