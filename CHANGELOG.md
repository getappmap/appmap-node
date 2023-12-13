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
