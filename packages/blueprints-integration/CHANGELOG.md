# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.0.0-0](https://github.com/nrkno/tv-automation-server-core/compare/v1.17.0...v2.0.0-0) (2021-02-09)


### Features

* add interface IAsRunEventUserContext ([a3284a8](https://github.com/nrkno/tv-automation-server-core/commit/a3284a8f217f4040b79cb49a95dccb969e12bb82))
* expose PartInstance.orphaned to blueprints [publish] ([e1dc02a](https://github.com/nrkno/tv-automation-server-core/commit/e1dc02acb73f86dc5f9979374973a2819cdafbc8))
* PartInstances without Parts ([#417](https://github.com/nrkno/tv-automation-server-core/issues/417)) ([8895258](https://github.com/nrkno/tv-automation-server-core/commit/889525886f986f69fb91af55b49ed9b93780b67c))
* remove impossible interfaces and add type predicate functions for ICommonContext and IUserNotesContext ([3aecc51](https://github.com/nrkno/tv-automation-server-core/commit/3aecc5118fa5c5a5c008655862349c87c563793b))
* ShowStyleBlueprintManifest.onAsRunEvent context changed to user context ([5738cf9](https://github.com/nrkno/tv-automation-server-core/commit/5738cf97b70c452ecfc3ed0b5a3515105b292d38))
* ShowStyleBlueprintManifest.onTimelineGenerate changed to have user space context. Unused context argument removed from ShowStyleBlueprintManifest.getEndStateForPart ([ef97859](https://github.com/nrkno/tv-automation-server-core/commit/ef978590894d249796e9e853f24d3684c6ec43f3))
* simplify some piece content typings ([#388](https://github.com/nrkno/tv-automation-server-core/issues/388)) [publish] ([#388](https://github.com/nrkno/tv-automation-server-core/issues/388)) ([359916f](https://github.com/nrkno/tv-automation-server-core/commit/359916fbcfd2f86a2a0a2f836bef871a83a736c3))


### Bug Fixes

* add hint field to config manifest interfaces [publish] ([74b93b9](https://github.com/nrkno/tv-automation-server-core/commit/74b93b9113f824d225a47e976b9abb9cb5637395))
* bring back context argument for ShowStyleBlueprintManifest.getEndStateForPart ([903c6ab](https://github.com/nrkno/tv-automation-server-core/commit/903c6ab49f495fea7f25287826f854b96b3419a1))
* change back to non user contexts for ShowStyleBlueprintManifest.onTimelineGenerate and onAsRunEvent ([cfc0a1b](https://github.com/nrkno/tv-automation-server-core/commit/cfc0a1b40d23e59cfa3d2965f1480893c59f2204))
* remove unused context argument from StudioBlueprintManifest.getRundownPlaylistInfo, StudioBlueprintManifest.preprocessConfig and ShowStyleBlueprintManifest.getShowStyleVariantId ([0e30711](https://github.com/nrkno/tv-automation-server-core/commit/0e30711831ce11366be5ea1fecb595c3279805ac))
* remove unused import (linting error) ([970c8ea](https://github.com/nrkno/tv-automation-server-core/commit/970c8ea155fb6229c02c410afe0da3c8f78fdfdd))
* settle inconsistencies between outdated translation code and newer blueprint changes ([5cdf1e5](https://github.com/nrkno/tv-automation-server-core/commit/5cdf1e5a7f722c31411c8d95efd6e2228c6e4344))

## [1.17.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.16.2...v1.17.0) (2021-02-08)

## [1.17.0-in-testing-R29.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.16.0-in-testing-R28.1...v1.17.0-in-testing-R29.1) (2021-01-15)


### Features

* add getPartInstanceForPreviousPiece method to ActionExecutionContext ([74f939e](https://github.com/nrkno/tv-automation-server-core/commit/74f939e4b18835d83f9fa84302ac6a8f73a764f3))
* special timeline class for when the first part hasn't been taken ([#421](https://github.com/nrkno/tv-automation-server-core/issues/421)) ([789f8cb](https://github.com/nrkno/tv-automation-server-core/commit/789f8cbdf9d9bcf1594d78090152659aa486cd79))

## [1.17.0-in-testing-R29.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.16.0-in-testing-R28.1...v1.17.0-in-testing-R29.1) (2021-01-15)


### Features

* add getPartInstanceForPreviousPiece method to ActionExecutionContext ([74f939e](https://github.com/nrkno/tv-automation-server-core/commit/74f939e4b18835d83f9fa84302ac6a8f73a764f3))
* special timeline class for when the first part hasn't been taken ([#421](https://github.com/nrkno/tv-automation-server-core/issues/421)) ([789f8cb](https://github.com/nrkno/tv-automation-server-core/commit/789f8cbdf9d9bcf1594d78090152659aa486cd79))

## [1.16.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.16.0-in-testing-R28.1...v1.16.0) (2021-01-19)

## [1.16.0-in-testing-R28.1](https://github.com/nrkno/tv-automation-server-core/compare/v1.16.0-in-testing-R28.0...v1.16.0-in-testing-R28.1) (2020-12-14)

## [1.16.0-in-testing-R28.0](https://github.com/nrkno/tv-automation-server-core/compare/v1.15.0...v1.16.0-in-testing-R28.0) (2020-12-14)


### Features

* additional Action Manifest properties ([bbe47a8](https://github.com/nrkno/tv-automation-server-core/commit/bbe47a8a1530f9820407aed36f9bc42ffff4e1d8))
* import bucket actions via blueprints ([a9221b6](https://github.com/nrkno/tv-automation-server-core/commit/a9221b65ab502c16344e93124a14e50bbe5a36aa))
* mono repo ([49c12e0](https://github.com/nrkno/tv-automation-server-core/commit/49c12e0d8a79113a5647236602390d315fc2fd8f))
* remove blueprints minimumCoreVersion as the version of blueprin… ([#405](https://github.com/nrkno/tv-automation-server-core/issues/405)) ([ff775ad](https://github.com/nrkno/tv-automation-server-core/commit/ff775ad5485d1960c15cc565a940d2579c68e66e))
* update policies enhancements ([#380](https://github.com/nrkno/tv-automation-server-core/issues/380)) ([5a5b8ab](https://github.com/nrkno/tv-automation-server-core/commit/5a5b8ab55f3e867f05c60572df7db0aed6bc5f6e))


### Bug Fixes

* remove worksOn and replace with just a simple triggerLabel: string ([4bf45f2](https://github.com/nrkno/tv-automation-server-core/commit/4bf45f2fd433143274fd52cef6fc5e029b8fc89c))
