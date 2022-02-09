---
sidebar_label: v1.40 (2022-03)
sidebar_position: 993 # Note: decrement for each release
title: Release 40
---

Release date: 2022-03 \(1.40.0-in-testing.0\)

### Main features

The main focus of this release is 'Multi-threaded core', as well as small bug fixes. This should help make performance more consistent.

- [Multi-threaded core](https://github.com/nrkno/sofie-core/pull/637) - Execution of playout and ingest operations are done in worker_threads, to reduce the amount of work done in the single meteor thread.
- [Meteor upgrade to 2.5](https://github.com/nrkno/sofie-core/pull/664) - Runs on Node 14, and uses MongoDB 4.4
- [AdlLibs from other ShowStyles are shown as disabled](https://github.com/nrkno/sofie-core/pull/665)
- [Ask for confirmation before restarting playout-gateway](https://github.com/nrkno/sofie-core/pull/666)
- [Improve accuracy of package framerate detection](https://github.com/nrkno/sofie-core/pull/653)
- Various other fixes and small improvements

### Components

| Component                                                                                                                                                                                                                                                                                                                                                        | Version           |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| [Core](https://github.com/nrkno/sofie-core) <br/> [Blueprints API ( Core )](https://www.npmjs.com/package/@sofie-automation/blueprints-integration)<br/>[Gateway API](https://www.npmjs.com/package/@sofie-automation/server-core-integration)<br/>[Mos Gateway](https://github.com/nrkno/sofie-core)<br/>[Playout Gateway](https://github.com/nrkno/sofie-core) | 1.40              |
| [Blueprints API ( TSR )](https://www.npmjs.com/package/timeline-state-resolver)                                                                                                                                                                                                                                                                                  | 6.4.0 (Unchanged) |
| [Media Manager](https://github.com/nrkno/sofie-media-management)                                                                                                                                                                                                                                                                                                 | 1.13 (Unchanged)  |
| [Quantel Gateway](https://github.com/nrkno/sofie-quantel-gateway)                                                                                                                                                                                                                                                                                                | 1.5.1 (Unchanged) |
