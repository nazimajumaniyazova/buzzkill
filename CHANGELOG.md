# Changelog

## [0.43.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.42.0...v0.43.0) (2026-11-26)


### Features

* **game:** say what struck the hero in playerHit ([#259](https://github.com/nazimajumaniyazova/buzzkill/issues/259)) ([69eeb3c](https://github.com/nazimajumaniyazova/buzzkill/commit/69eeb3c3b87f9afe87166d8c8891ff4a915b6135)), closes [#223](https://github.com/nazimajumaniyazova/buzzkill/issues/223)
* **web:** add the analytics module, which counts nothing it may not ([#258](https://github.com/nazimajumaniyazova/buzzkill/issues/258)) ([c203d22](https://github.com/nazimajumaniyazova/buzzkill/commit/c203d22b33ccba95f4e4f15cf5e2254617718320)), closes [#223](https://github.com/nazimajumaniyazova/buzzkill/issues/223)
* **web:** let the built page connect only to its backend and analytics ([#260](https://github.com/nazimajumaniyazova/buzzkill/issues/260)) ([f1d895a](https://github.com/nazimajumaniyazova/buzzkill/commit/f1d895a14c12bddc8bd9fa63dabf848b177db1ab)), closes [#223](https://github.com/nazimajumaniyazova/buzzkill/issues/223)
* **web:** show the boards and the player's own record in the menu ([#257](https://github.com/nazimajumaniyazova/buzzkill/issues/257)) ([87b47bb](https://github.com/nazimajumaniyazova/buzzkill/commit/87b47bbbd0e962288db118d20b6bc6a637202fe3)), closes [#220](https://github.com/nazimajumaniyazova/buzzkill/issues/220)

## [0.42.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.41.0...v0.42.0) (2026-11-24)


### Features

* **web:** add the dialog where a player picks a nickname ([#255](https://github.com/nazimajumaniyazova/buzzkill/issues/255)) ([16bb904](https://github.com/nazimajumaniyazova/buzzkill/commit/16bb904c4a0b898e30104d894886f2bc6379d79f)), closes [#217](https://github.com/nazimajumaniyazova/buzzkill/issues/217)
* **web:** send each finished run to submit-run as the player ([#254](https://github.com/nazimajumaniyazova/buzzkill/issues/254)) ([cd2bbc2](https://github.com/nazimajumaniyazova/buzzkill/commit/cd2bbc269d4cf533d4b70f7af4fd48a337afcf3c)), closes [#220](https://github.com/nazimajumaniyazova/buzzkill/issues/220)

## [0.41.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.40.0...v0.41.0) (2026-11-24)


### Features

* **backend:** merge a device's achievements into the account's ([#248](https://github.com/nazimajumaniyazova/buzzkill/issues/248)) ([acf4f4f](https://github.com/nazimajumaniyazova/buzzkill/commit/acf4f4feab5c98ceb026435558927d3b2dd075b3)), closes [#221](https://github.com/nazimajumaniyazova/buzzkill/issues/221)
* **web:** add the Supabase client, loaded on demand, and the player ([#252](https://github.com/nazimajumaniyazova/buzzkill/issues/252)) ([0dacd11](https://github.com/nazimajumaniyazova/buzzkill/commit/0dacd1145443e0dbb8a217b6de9c3948a8cc5f94)), closes [#217](https://github.com/nazimajumaniyazova/buzzkill/issues/217)
* **web:** keep finished runs in a queue until the server has them ([#249](https://github.com/nazimajumaniyazova/buzzkill/issues/249)) ([f512196](https://github.com/nazimajumaniyazova/buzzkill/commit/f5121960c81826209901288f67b3b0204c669f77)), closes [#220](https://github.com/nazimajumaniyazova/buzzkill/issues/220)
* **web:** note when achievements unlock, and merge them with an account ([#247](https://github.com/nazimajumaniyazova/buzzkill/issues/247)) ([22ab22a](https://github.com/nazimajumaniyazova/buzzkill/commit/22ab22ab117f20c117f351c8d7d95c7c7ab1007b)), closes [#221](https://github.com/nazimajumaniyazova/buzzkill/issues/221)

## [0.40.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.39.0...v0.40.0) (2026-11-23)


### Features

* **game:** play a stored run again on screen through a replay input ([#243](https://github.com/nazimajumaniyazova/buzzkill/issues/243)) ([e5a29ad](https://github.com/nazimajumaniyazova/buzzkill/commit/e5a29ad6da3bea8d1ea21c1535f09f92e0173ec4)), closes [#219](https://github.com/nazimajumaniyazova/buzzkill/issues/219)
* **web:** watch the replay of a finished run, at 0.5× to 4× ([#244](https://github.com/nazimajumaniyazova/buzzkill/issues/244)) ([03ee0c6](https://github.com/nazimajumaniyazova/buzzkill/commit/03ee0c66da2fab7ce17e9ca347df3dfb0f08d4c8)), closes [#219](https://github.com/nazimajumaniyazova/buzzkill/issues/219)

## [0.39.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.38.0...v0.39.0) (2026-11-22)


### Features

* **backend:** check nicknames by the same rules in the app and database ([#240](https://github.com/nazimajumaniyazova/buzzkill/issues/240)) ([898a716](https://github.com/nazimajumaniyazova/buzzkill/commit/898a71650f65ed8bfc6e12c8cf51feeb241efb77)), closes [#217](https://github.com/nazimajumaniyazova/buzzkill/issues/217)

## [0.38.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.37.0...v0.38.0) (2026-11-21)


### Features

* **backend:** bundle submit-run as an Edge Function and play it in CI ([#237](https://github.com/nazimajumaniyazova/buzzkill/issues/237)) ([3e0620f](https://github.com/nazimajumaniyazova/buzzkill/commit/3e0620f6986e07b862dc33703569bab6165cb79c)), closes [#218](https://github.com/nazimajumaniyazova/buzzkill/issues/218)
* **backend:** refuse runs past an hour of play an hour, with 429 ([#238](https://github.com/nazimajumaniyazova/buzzkill/issues/238)) ([a7ab467](https://github.com/nazimajumaniyazova/buzzkill/commit/a7ab4678adddf97a8b614998fef02c27fbdd7211)), closes [#235](https://github.com/nazimajumaniyazova/buzzkill/issues/235)

## [0.37.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.36.0...v0.37.0) (2026-11-20)


### Features

* **backend:** answer submit-run requests and store runs in Supabase ([#234](https://github.com/nazimajumaniyazova/buzzkill/issues/234)) ([7187823](https://github.com/nazimajumaniyazova/buzzkill/commit/718782302cafa6038a1150f0fecd45a34bc04a2c))
* **backend:** log replays that play to another result than claimed ([#233](https://github.com/nazimajumaniyazova/buzzkill/issues/233)) ([23a29c1](https://github.com/nazimajumaniyazova/buzzkill/commit/23a29c1d7fbbc72de99d91769a92c2fe11ea8b66))
* **web:** version a build by its release and simulation sources ([#232](https://github.com/nazimajumaniyazova/buzzkill/issues/232)) ([387f636](https://github.com/nazimajumaniyazova/buzzkill/commit/387f636aa78945dca3597ddc9aa93257eb643f6d))

## [0.36.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.35.0...v0.36.0) (2026-11-20)


### Features

* **backend:** let anyone read the boards and only the server add runs ([#228](https://github.com/nazimajumaniyazova/buzzkill/issues/228)) ([2d3d164](https://github.com/nazimajumaniyazova/buzzkill/commit/2d3d1642d5961a8a1298f1b35888948101ee2af3))
* **backend:** verify a submitted run by playing its replay again ([#229](https://github.com/nazimajumaniyazova/buzzkill/issues/229)) ([ced90d7](https://github.com/nazimajumaniyazova/buzzkill/commit/ced90d7453c279e9f6e0e9a47e5cac5b6ea638ef))

## [0.35.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.34.0...v0.35.0) (2026-11-20)


### Features

* **backend:** store runs, profiles and achievements in migrations ([#225](https://github.com/nazimajumaniyazova/buzzkill/issues/225)) ([dc2f8c8](https://github.com/nazimajumaniyazova/buzzkill/commit/dc2f8c875a0e4a1c89ab8b598099428d66f5e977))

## [0.34.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.33.0...v0.34.0) (2026-11-19)


### Features

* **web:** stream Pixel War 1 by Abstraction during a run ([#211](https://github.com/nazimajumaniyazova/buzzkill/issues/211)) ([b915925](https://github.com/nazimajumaniyazova/buzzkill/commit/b915925c641f6764b345aef0f97e8ecb4cd31149)), closes [#161](https://github.com/nazimajumaniyazova/buzzkill/issues/161)

## [0.33.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.32.0...v0.33.0) (2026-11-19)


### Features

* **web:** play the music during a run, once there is a track ([#209](https://github.com/nazimajumaniyazova/buzzkill/issues/209)) ([008c733](https://github.com/nazimajumaniyazova/buzzkill/commit/008c733552c5564bc43cdd9fdec555f99ff74712))

## [0.32.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.31.0...v0.32.0) (2026-11-19)


### Features

* add Sam and Leo, heroes that achievements unlock ([#207](https://github.com/nazimajumaniyazova/buzzkill/issues/207)) ([4f9be16](https://github.com/nazimajumaniyazova/buzzkill/commit/4f9be16c36ea61c233fa75c9e4ed0acfec7be1d9)), closes [#164](https://github.com/nazimajumaniyazova/buzzkill/issues/164)

## [0.31.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.30.0...v0.31.0) (2026-11-18)


### Features

* **web:** offer the daily challenge in the menu with today's best ([#205](https://github.com/nazimajumaniyazova/buzzkill/issues/205)) ([0f4b892](https://github.com/nazimajumaniyazova/buzzkill/commit/0f4b892d8a577c0cc26d5473c3b2d4a12081f2c0)), closes [#165](https://github.com/nazimajumaniyazova/buzzkill/issues/165)

## [0.30.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.29.0...v0.30.0) (2026-11-17)


### Features

* **web:** keep the achievements, toast each one earned and list them ([#203](https://github.com/nazimajumaniyazova/buzzkill/issues/203)) ([73ef981](https://github.com/nazimajumaniyazova/buzzkill/commit/73ef981fe7f2ef19445ade9ec60b82f6b48fc4f2)), closes [#163](https://github.com/nazimajumaniyazova/buzzkill/issues/163)

## [0.29.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.28.0...v0.29.0) (2026-11-17)


### Features

* **web:** give the music a budget of its own and duck it on explosions ([#201](https://github.com/nazimajumaniyazova/buzzkill/issues/201)) ([4d9dc18](https://github.com/nazimajumaniyazova/buzzkill/commit/4d9dc1848ca482c99d9bbabd7a3e38733e0c82aa))

## [0.28.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.27.0...v0.28.0) (2026-11-17)


### Features

* **web:** vary the pitch of each sound and place it by its x ([#199](https://github.com/nazimajumaniyazova/buzzkill/issues/199)) ([cb2f838](https://github.com/nazimajumaniyazova/buzzkill/commit/cb2f838999d7caf540c4a69929fe03e3bd43e824))

## [0.27.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.26.0...v0.27.0) (2026-11-17)


### Features

* **web:** pause a run when its gamepad goes away, and rumble on a hit ([#197](https://github.com/nazimajumaniyazova/buzzkill/issues/197)) ([1c08a7c](https://github.com/nazimajumaniyazova/buzzkill/commit/1c08a7c1ad91c858a66159e502869786204d60fb)), closes [#154](https://github.com/nazimajumaniyazova/buzzkill/issues/154)

## [0.26.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.25.0...v0.26.0) (2026-11-17)


### Features

* **web:** bounce the score, blink a lost life and fade in the screens ([#193](https://github.com/nazimajumaniyazova/buzzkill/issues/193)) ([38497cb](https://github.com/nazimajumaniyazova/buzzkill/commit/38497cb4e5fbad4eeae2950890f647763949b7f2))
* **web:** burst sparks, debris, dust and trails from the run's events ([#189](https://github.com/nazimajumaniyazova/buzzkill/issues/189)) ([dfeeb9f](https://github.com/nazimajumaniyazova/buzzkill/commit/dfeeb9fe540a300e137f65649d330f5b4ae54bf1))
* **web:** flash sprites on hits, and squash and stretch them ([#191](https://github.com/nazimajumaniyazova/buzzkill/issues/191)) ([2dff797](https://github.com/nazimajumaniyazova/buzzkill/commit/2dff797564a1e3339898f79c81c1452b5bb2989d)), closes [#159](https://github.com/nazimajumaniyazova/buzzkill/issues/159)
* **web:** hold the picture for a moment on strong blows ([#194](https://github.com/nazimajumaniyazova/buzzkill/issues/194)) ([cb05cde](https://github.com/nazimajumaniyazova/buzzkill/commit/cb05cde0c9beedeac28b64623c23793726637ed0)), closes [#158](https://github.com/nazimajumaniyazova/buzzkill/issues/158)
* **web:** shake the screen on hits, explosions and the queen ([#190](https://github.com/nazimajumaniyazova/buzzkill/issues/190)) ([80cc8e7](https://github.com/nazimajumaniyazova/buzzkill/commit/80cc8e7bfb01f6cc663242f25a68574600a10b6f)), closes [#157](https://github.com/nazimajumaniyazova/buzzkill/issues/157)
* **web:** vibrate the phone briefly when the hero is hit ([#195](https://github.com/nazimajumaniyazova/buzzkill/issues/195)) ([154f35c](https://github.com/nazimajumaniyazova/buzzkill/commit/154f35c179a510eddf5c7765ed9b91dd2a314dfc)), closes [#162](https://github.com/nazimajumaniyazova/buzzkill/issues/162)

## [0.25.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.24.0...v0.25.0) (2026-11-17)


### Features

* **web:** burst sparks, debris, dust and trails from the run's events ([#189](https://github.com/nazimajumaniyazova/buzzkill/issues/189)) ([dfeeb9f](https://github.com/nazimajumaniyazova/buzzkill/commit/dfeeb9fe540a300e137f65649d330f5b4ae54bf1))
* **web:** flash sprites on hits, and squash and stretch them ([#191](https://github.com/nazimajumaniyazova/buzzkill/issues/191)) ([2dff797](https://github.com/nazimajumaniyazova/buzzkill/commit/2dff797564a1e3339898f79c81c1452b5bb2989d)), closes [#159](https://github.com/nazimajumaniyazova/buzzkill/issues/159)
* **web:** play on touch screens with a stick and a fire button ([#187](https://github.com/nazimajumaniyazova/buzzkill/issues/187)) ([c7bc3cb](https://github.com/nazimajumaniyazova/buzzkill/commit/c7bc3cb427f3f6bf4ab671943a4be2010b378500))
* **web:** shake the screen on hits, explosions and the queen ([#190](https://github.com/nazimajumaniyazova/buzzkill/issues/190)) ([80cc8e7](https://github.com/nazimajumaniyazova/buzzkill/commit/80cc8e7bfb01f6cc663242f25a68574600a10b6f)), closes [#157](https://github.com/nazimajumaniyazova/buzzkill/issues/157)

## [0.24.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.23.0...v0.24.0) (2026-11-16)


### Features

* **game:** end the third and the sixth level with the queen ([#183](https://github.com/nazimajumaniyazova/buzzkill/issues/183)) ([7307923](https://github.com/nazimajumaniyazova/buzzkill/commit/7307923103f421a4f9a4257f75af42bf7f33b58c))


### Bug fixes

* **web:** give the mixer every sound of the game ([#182](https://github.com/nazimajumaniyazova/buzzkill/issues/182)) ([9dd9649](https://github.com/nazimajumaniyazova/buzzkill/commit/9dd9649f091b433a4870548ef627327574c99c2c)), closes [#181](https://github.com/nazimajumaniyazova/buzzkill/issues/181)

## [0.23.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.22.0...v0.23.0) (2026-11-14)


### Features

* **game:** fight the queen wasp in the simulation ([#179](https://github.com/nazimajumaniyazova/buzzkill/issues/179)) ([9ea020a](https://github.com/nazimajumaniyazova/buzzkill/commit/9ea020acb3e7c36496c8232a9844ae993c628102))

## [0.22.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.21.0...v0.22.0) (2026-11-13)


### Features

* **game:** drop power-ups that the hero collects ([#173](https://github.com/nazimajumaniyazova/buzzkill/issues/173)) ([fb2bd8f](https://github.com/nazimajumaniyazova/buzzkill/commit/fb2bd8f367520ad86371a8f3f1589040010e7ba2)), closes [#151](https://github.com/nazimajumaniyazova/buzzkill/issues/151)

## [0.21.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.20.0...v0.21.0) (2026-11-13)


### Features

* **art:** draw the queen wasp, her rage and her sting ([#174](https://github.com/nazimajumaniyazova/buzzkill/issues/174)) ([4d1077c](https://github.com/nazimajumaniyazova/buzzkill/commit/4d1077ca8b8c7f0679084f5354ef44a8c10c6e1a))

## [0.20.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.19.0...v0.20.0) (2026-11-13)


### Features

* **art:** draw the four power-ups ([#171](https://github.com/nazimajumaniyazova/buzzkill/issues/171)) ([3c8ac61](https://github.com/nazimajumaniyazova/buzzkill/commit/3c8ac61636f8ffee7cba4ba2d7c5c49efdb355c5))
* **game:** play the run at the difficulty of the settings ([#170](https://github.com/nazimajumaniyazova/buzzkill/issues/170)) ([7707924](https://github.com/nazimajumaniyazova/buzzkill/commit/7707924c94a66487ff5a5a34e7d606cefb407766)), closes [#155](https://github.com/nazimajumaniyazova/buzzkill/issues/155)

## [0.19.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.18.0...v0.19.0) (2026-11-12)


### Features

* **web:** hold the run on a screen between levels ([#168](https://github.com/nazimajumaniyazova/buzzkill/issues/168)) ([670cf11](https://github.com/nazimajumaniyazova/buzzkill/commit/670cf11819ca69906ee2e57316cfbdd586afc3f4)), closes [#150](https://github.com/nazimajumaniyazova/buzzkill/issues/150)

## [0.18.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.17.0...v0.18.0) (2026-11-12)


### Features

* **game:** play a run as a campaign of six levels ([#166](https://github.com/nazimajumaniyazova/buzzkill/issues/166)) ([0939294](https://github.com/nazimajumaniyazova/buzzkill/commit/0939294f3b49798c582d95a8366b718f0ba3988f))

## [0.17.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.16.0...v0.17.0) (2026-11-12)


### Features

* **web:** draw the city behind the run in parallax layers ([#146](https://github.com/nazimajumaniyazova/buzzkill/issues/146)) ([dbff7b8](https://github.com/nazimajumaniyazova/buzzkill/commit/dbff7b8467ab8e84f0c6623b9c9ef476d18ebdce)), closes [#133](https://github.com/nazimajumaniyazova/buzzkill/issues/133)

## [0.16.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.15.0...v0.16.0) (2026-11-12)


### Features

* **engine:** try a fallback file when an asset does not decode ([#143](https://github.com/nazimajumaniyazova/buzzkill/issues/143)) ([72003af](https://github.com/nazimajumaniyazova/buzzkill/commit/72003aff8daa5c6eca97ee58ad73a5078ab34d65))
* **web:** build the game's atlases and sounds from the art ([#145](https://github.com/nazimajumaniyazova/buzzkill/issues/145)) ([1410e85](https://github.com/nazimajumaniyazova/buzzkill/commit/1410e859f6cc4437d9b338886d97e9299cf60380))

## [0.15.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.14.0...v0.15.0) (2026-11-12)


### Features

* **web:** add the CC0 sounds chosen for the game ([#139](https://github.com/nazimajumaniyazova/buzzkill/issues/139)) ([9821edf](https://github.com/nazimajumaniyazova/buzzkill/commit/9821edf0709fa588d5f7d1082e075be40f361546)), closes [#132](https://github.com/nazimajumaniyazova/buzzkill/issues/132)

## [0.14.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.13.0...v0.14.0) (2026-11-11)


### Features

* **art:** draw the game's sprites and city as vector code ([#137](https://github.com/nazimajumaniyazova/buzzkill/issues/137)) ([73c037b](https://github.com/nazimajumaniyazova/buzzkill/commit/73c037be658f5774fcfd32b634a16b085dafe77f))

## [0.13.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.12.0...v0.13.0) (2026-11-10)


### Features

* **web:** announce the run, follow reduced motion and pace the game ([#128](https://github.com/nazimajumaniyazova/buzzkill/issues/128)) ([279eb21](https://github.com/nazimajumaniyazova/buzzkill/commit/279eb21bd3c3d4b63791ef4905bed3bb5641a2f8)), closes [#114](https://github.com/nazimajumaniyazova/buzzkill/issues/114)

## [0.12.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.11.1...v0.12.0) (2026-11-10)


### Features

* **web:** catch unexpected errors with a Restart screen ([#126](https://github.com/nazimajumaniyazova/buzzkill/issues/126)) ([cb27a21](https://github.com/nazimajumaniyazova/buzzkill/commit/cb27a213aade74d1f9ff28c693bfee4f288af0d5)), closes [#113](https://github.com/nazimajumaniyazova/buzzkill/issues/113)

## [0.11.1](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.11.0...v0.11.1) (2026-11-10)


### Performance

* **web:** load the game chunk and its files after the menu ([#124](https://github.com/nazimajumaniyazova/buzzkill/issues/124)) ([2fe0e02](https://github.com/nazimajumaniyazova/buzzkill/commit/2fe0e0246ee083299168a4b56958a5fef3bc013d)), closes [#112](https://github.com/nazimajumaniyazova/buzzkill/issues/112)

## [0.11.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.10.0...v0.11.0) (2026-11-10)


### Features

* **web:** speak English and Russian from a typed dictionary ([#122](https://github.com/nazimajumaniyazova/buzzkill/issues/122)) ([62f79e2](https://github.com/nazimajumaniyazova/buzzkill/commit/62f79e204245fd0231250198c431ff6cf9f7906c)), closes [#111](https://github.com/nazimajumaniyazova/buzzkill/issues/111)

## [0.10.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.9.0...v0.10.0) (2026-11-09)


### Features

* **web:** keep the settings under a versioned schema with migrations ([#120](https://github.com/nazimajumaniyazova/buzzkill/issues/120)) ([51407d0](https://github.com/nazimajumaniyazova/buzzkill/commit/51407d0e04ecf21a9f882c2846f1c430dcde58ef)), closes [#110](https://github.com/nazimajumaniyazova/buzzkill/issues/110)


### Performance

* **web:** subscribe each HUD value through its own selector ([#119](https://github.com/nazimajumaniyazova/buzzkill/issues/119)) ([9bf9e0d](https://github.com/nazimajumaniyazova/buzzkill/commit/9bf9e0d3a58f53219ed05370f7ef36580f2c6c09)), closes [#109](https://github.com/nazimajumaniyazova/buzzkill/issues/109)

## [0.9.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.8.0...v0.9.0) (2026-11-09)


### Features

* **web:** build the screens of the shell on the design system ([#117](https://github.com/nazimajumaniyazova/buzzkill/issues/117)) ([1bf4ce1](https://github.com/nazimajumaniyazova/buzzkill/commit/1bf4ce13522b9064171ab3c5d12f509d5c6c5f7c)), closes [#108](https://github.com/nazimajumaniyazova/buzzkill/issues/108)
* **web:** drive the shell from a typed state machine ([#116](https://github.com/nazimajumaniyazova/buzzkill/issues/116)) ([36a651f](https://github.com/nazimajumaniyazova/buzzkill/commit/36a651f15c2e920827e0d2a494a46f8a465a9b56)), closes [#107](https://github.com/nazimajumaniyazova/buzzkill/issues/107)

## [0.8.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.7.0...v0.8.0) (2026-11-09)


### Features

* **ui:** add toast notifications with live-region announcements ([#102](https://github.com/nazimajumaniyazova/buzzkill/issues/102)) ([ca2eedb](https://github.com/nazimajumaniyazova/buzzkill/commit/ca2eedb9627956c44242df96cc4f72b6d99d7378)), closes [#84](https://github.com/nazimajumaniyazova/buzzkill/issues/84)

## [0.7.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.6.0...v0.7.0) (2026-11-09)


### Features

* **ui:** add Tabs with automatic or manual activation ([#100](https://github.com/nazimajumaniyazova/buzzkill/issues/100)) ([fe53bac](https://github.com/nazimajumaniyazova/buzzkill/commit/fe53bac013c9cf2f0b6ec781951b5f69c907df62)), closes [#83](https://github.com/nazimajumaniyazova/buzzkill/issues/83)

## [0.6.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.5.0...v0.6.0) (2026-11-08)


### Features

* **ui:** add Switch, Slider and RadioGroup with both state modes ([#98](https://github.com/nazimajumaniyazova/buzzkill/issues/98)) ([96d12c3](https://github.com/nazimajumaniyazova/buzzkill/commit/96d12c33c0259b9ed43132d74dc2b0538c3620ea)), closes [#82](https://github.com/nazimajumaniyazova/buzzkill/issues/82)

## [0.5.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.4.0...v0.5.0) (2026-11-08)


### Features

* **ui:** add Dialog on the native modal with focus return and Escape ([#95](https://github.com/nazimajumaniyazova/buzzkill/issues/95)) ([c649cd0](https://github.com/nazimajumaniyazova/buzzkill/commit/c649cd059df9adc476a89327d08c219f5de93b35)), closes [#80](https://github.com/nazimajumaniyazova/buzzkill/issues/80)
* **ui:** add Menu and MenuItem with a roving tabindex ([#96](https://github.com/nazimajumaniyazova/buzzkill/issues/96)) ([3dff4f7](https://github.com/nazimajumaniyazova/buzzkill/commit/3dff4f7b83ce531d2d14c001a41f860765dc6b97)), closes [#81](https://github.com/nazimajumaniyazova/buzzkill/issues/81)

## [0.4.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.3.0...v0.4.0) (2026-11-08)


### Features

* **ui:** add Button and IconButton on the first component tokens ([#93](https://github.com/nazimajumaniyazova/buzzkill/issues/93)) ([fa901d1](https://github.com/nazimajumaniyazova/buzzkill/commit/fa901d10e03ba010a36e81d6a78f04553f445cfc)), closes [#79](https://github.com/nazimajumaniyazova/buzzkill/issues/79)
* **ui:** add Stack, Inline, VisuallyHidden and KeyHint primitives ([#92](https://github.com/nazimajumaniyazova/buzzkill/issues/92)) ([865f9cc](https://github.com/nazimajumaniyazova/buzzkill/commit/865f9ccbbc42804ee035950f21be885d37e0fefe)), closes [#78](https://github.com/nazimajumaniyazova/buzzkill/issues/78)

## [0.3.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.2.0...v0.3.0) (2026-11-08)


### Features

* **ui:** add Storybook with token docs, theme switcher and a11y tests ([#90](https://github.com/nazimajumaniyazova/buzzkill/issues/90)) ([3b01f76](https://github.com/nazimajumaniyazova/buzzkill/commit/3b01f768bd92aabfb67a48f3e4bef5a6b45b9849)), closes [#76](https://github.com/nazimajumaniyazova/buzzkill/issues/76)
* **ui:** follow the user's theme, motion and contrast preferences ([#89](https://github.com/nazimajumaniyazova/buzzkill/issues/89)) ([a33b25c](https://github.com/nazimajumaniyazova/buzzkill/commit/a33b25ce40788cda28cf27d459efe2b092dafe1c)), closes [#75](https://github.com/nazimajumaniyazova/buzzkill/issues/75)

## [0.2.0](https://github.com/nazimajumaniyazova/buzzkill/compare/v0.1.0...v0.2.0) (2026-11-08)


### Features

* **ui:** add design tokens in three layers with a generated stylesheet ([#87](https://github.com/nazimajumaniyazova/buzzkill/issues/87)) ([ed4a751](https://github.com/nazimajumaniyazova/buzzkill/commit/ed4a751fea4893347039567005d917efb96fa8c5)), closes [#74](https://github.com/nazimajumaniyazova/buzzkill/issues/74)

## 0.1.0 (2026-11-08)


### Features

* **engine:** add a fixed-timestep game loop with visibility pause ([#55](https://github.com/nazimajumaniyazova/buzzkill/issues/55)) ([bf6cc24](https://github.com/nazimajumaniyazova/buzzkill/commit/bf6cc241907686f2918d94be9f3b0fb0b7cae4bf)), closes [#33](https://github.com/nazimajumaniyazova/buzzkill/issues/33)
* **engine:** add action-based input for keyboard, touch and gamepad ([#57](https://github.com/nazimajumaniyazova/buzzkill/issues/57)) ([6dffcec](https://github.com/nazimajumaniyazova/buzzkill/commit/6dffcec9c6742d37b6c0e0b32a9adef6933d9ccd)), closes [#34](https://github.com/nazimajumaniyazova/buzzkill/issues/34)
* **engine:** add collisions, pools, event bus, seeded RNG, canvas fit ([#56](https://github.com/nazimajumaniyazova/buzzkill/issues/56)) ([18f688b](https://github.com/nazimajumaniyazova/buzzkill/commit/18f688ba39e0782771ff08c6049e12f9b73d577a)), closes [#37](https://github.com/nazimajumaniyazova/buzzkill/issues/37)
* **engine:** load assets up front and draw through a Canvas 2D renderer ([#65](https://github.com/nazimajumaniyazova/buzzkill/issues/65)) ([45e18d7](https://github.com/nazimajumaniyazova/buzzkill/commit/45e18d7dd89c5f05e68f402de575c7355f9c1e05)), closes [#35](https://github.com/nazimajumaniyazova/buzzkill/issues/35) [#63](https://github.com/nazimajumaniyazova/buzzkill/issues/63)
* **engine:** play sounds through a Web Audio mixer with volume groups ([#66](https://github.com/nazimajumaniyazova/buzzkill/issues/66)) ([5acfe61](https://github.com/nazimajumaniyazova/buzzkill/commit/5acfe61436f74cbcce0bac7c6462f6d8c447844c)), closes [#36](https://github.com/nazimajumaniyazova/buzzkill/issues/36)
* **game:** add background ([a493b30](https://github.com/nazimajumaniyazova/buzzkill/commit/a493b3090cbc9dff0062c6c97c0a719e1947d5dd))
* **game:** add background animation ([0392d1d](https://github.com/nazimajumaniyazova/buzzkill/commit/0392d1de9da764e5a84760620750fde5d6611105))
* **game:** add bullet sound effect ([f61037a](https://github.com/nazimajumaniyazova/buzzkill/commit/f61037abf46a17b5eb3e55f75d01e468e3be1434))
* **game:** add enemy ([98504c9](https://github.com/nazimajumaniyazova/buzzkill/commit/98504c961a138ce5c1214b293ac36dc50a2f149b))
* **game:** add enemy ([831a932](https://github.com/nazimajumaniyazova/buzzkill/commit/831a932cfd0f41f8323cf198aa9cc644311daad0))
* **game:** add enemy lives progress bar ([5ef429a](https://github.com/nazimajumaniyazova/buzzkill/commit/5ef429a068e0de1e345231ad1340c1b561380cf6))
* **game:** add explotion sound effect ([2509585](https://github.com/nazimajumaniyazova/buzzkill/commit/250958594331a4e1a984bf6f23616676a70e51c9))
* **game:** add game night mode ([cf74eb9](https://github.com/nazimajumaniyazova/buzzkill/commit/cf74eb9df563a82719fec928e4c3bccb2bd8e2f7))
* **game:** add game volume controller ([45d3b5c](https://github.com/nazimajumaniyazova/buzzkill/commit/45d3b5cc1569a97012009be80fb72989433f2076))
* **game:** add hero selection ([2b551db](https://github.com/nazimajumaniyazova/buzzkill/commit/2b551db3d15c998fa1523be58eacafa02963018a))
* **game:** add increase enemies amount over time ([e811c9e](https://github.com/nazimajumaniyazova/buzzkill/commit/e811c9e9c9db87990de27f34cb808ffb78a973cc))
* **game:** add pain sound and explotion on player and enemy collition ([f30137e](https://github.com/nazimajumaniyazova/buzzkill/commit/f30137e3cc3858245bb799375e10239b55ec0f98))
* **game:** add player live ([7f07428](https://github.com/nazimajumaniyazova/buzzkill/commit/7f07428966619902659abf987991f74416e5ca8b))
* **game:** add player/projectile/inputHandler/Game class ([8e4b8d5](https://github.com/nazimajumaniyazova/buzzkill/commit/8e4b8d5755c071d0a3787de9946e8d6fcff73069))
* **game:** add score ([214b761](https://github.com/nazimajumaniyazova/buzzkill/commit/214b7611abacc1ac93dd56628ab53fd47a61ae9b))
* **game:** add several enemies ([502e94a](https://github.com/nazimajumaniyazova/buzzkill/commit/502e94a47c2f818d634cecc301fa32bb468c8dc8))
* **game:** add the createGame API with injected dependencies ([#61](https://github.com/nazimajumaniyazova/buzzkill/issues/61)) ([da0506d](https://github.com/nazimajumaniyazova/buzzkill/commit/da0506df8ce67feba3319aa4a494497968fbe83d)), closes [#40](https://github.com/nazimajumaniyazova/buzzkill/issues/40)
* **game:** addscore ([9aba87f](https://github.com/nazimajumaniyazova/buzzkill/commit/9aba87f16dfa438c70989a6433e3afa2335ac4fc))
* **game:** change bg ([428c6e9](https://github.com/nazimajumaniyazova/buzzkill/commit/428c6e9095d15d190efd16565303109089340f95))
* **game:** improve enemy movement ([d896de7](https://github.com/nazimajumaniyazova/buzzkill/commit/d896de7a97beacd9156e1b0e35384b19459f0eb6))
* **game:** minor changes ([9bf04f8](https://github.com/nazimajumaniyazova/buzzkill/commit/9bf04f8b0e41cda210d2b4b4a492cf872735340b))
* **game:** record replays and simulate them headlessly ([#62](https://github.com/nazimajumaniyazova/buzzkill/issues/62)) ([8f45921](https://github.com/nazimajumaniyazova/buzzkill/commit/8f4592123df82c3b00ed6f633e7fe38a240e2ac6)), closes [#41](https://github.com/nazimajumaniyazova/buzzkill/issues/41)
* **game:** simulate the game headlessly with data, world and systems ([#60](https://github.com/nazimajumaniyazova/buzzkill/issues/60)) ([b104f73](https://github.com/nazimajumaniyazova/buzzkill/commit/b104f73483ff3038900ce14cb1555208cc31a6b1)), closes [#38](https://github.com/nazimajumaniyazova/buzzkill/issues/38) [#39](https://github.com/nazimajumaniyazova/buzzkill/issues/39)
* **web:** add a start screen that launches the legacy game ([#50](https://github.com/nazimajumaniyazova/buzzkill/issues/50)) ([5ccd291](https://github.com/nazimajumaniyazova/buzzkill/commit/5ccd29194155b57f08d0132a7b03bd94738f7e25)), closes [#28](https://github.com/nazimajumaniyazova/buzzkill/issues/28)
* **web:** run the new game through createGame ([#67](https://github.com/nazimajumaniyazova/buzzkill/issues/67)) ([438c551](https://github.com/nazimajumaniyazova/buzzkill/commit/438c551cfd51d4b2698c7e54343e4ec544222d84))


### Bug fixes

* **game:** fix explotion animation ([4143ca9](https://github.com/nazimajumaniyazova/buzzkill/commit/4143ca986d51b455a8358eb88f84d7090446327a))
* **game:** fix image render ([1827bbd](https://github.com/nazimajumaniyazova/buzzkill/commit/1827bbdafe0ae6670178aadc1cb4e5f9423e1939))
* **game:** fix minor issues ([3557fb7](https://github.com/nazimajumaniyazova/buzzkill/commit/3557fb76bffdc7ce8076025a66b3a98f9d002599))
* **game:** fix player and enemy width ([2d6e3a3](https://github.com/nazimajumaniyazova/buzzkill/commit/2d6e3a372329ef2d601e309cc97a026b92673866))


### Performance

* **game:** benchmark a tick, a three-minute run and simulate ([#70](https://github.com/nazimajumaniyazova/buzzkill/issues/70)) ([aad1e06](https://github.com/nazimajumaniyazova/buzzkill/commit/aad1e064004e14d09f95694747c0104db31c8e54)), closes [#44](https://github.com/nazimajumaniyazova/buzzkill/issues/44)

## Changelog

All notable changes to this project are documented in this file. It is generated by
release-please from Conventional Commits. Do not edit it by hand.
