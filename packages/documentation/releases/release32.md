---
sidebar_label: v1.32 (2021-05-05)
sidebar_position: 1001
title: Release 32
---

Release date: 2021-05-05 \(1.32.0\)

### Main Features

- Experimental support for the new [package manager](https://github.com/nrkno/tv-automation-package-manager)
- Work on allowing a playout and ingest operation to run in parallel, to help avoid ingest updates blocking takes.
- Updated colour scheme for some piece types
- Segments are reset upon leaving, meaning they will match what is shown in the NRCS after being played
- Remove AsRunLog collection, and replace usages with the PartInstances and PieceInstances
- Improved segment header labels

### Components

| Component                                                                                                                                                                                                                                                                                                                                                                                                         | Version |
| :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------ |
| [Core](https://github.com/nrkno/tv-automation-server-core) <br/> [Blueprints API ( Core )](https://www.npmjs.com/package/@sofie-automation/blueprints-integration)<br/>[Gateway API](https://www.npmjs.com/package/@sofie-automation/server-core-integration)<br/>[Mos Gateway](https://github.com/nrkno/tv-automation-mos-gateway)<br/>[Playout Gateway](https://github.com/nrkno/tv-automation-playout-gateway) | 1.32    |
| [Blueprints API ( TSR )](https://www.npmjs.com/package/timeline-state-resolver)                                                                                                                                                                                                                                                                                                                                   | 5.7     |
| [Media Manager](https://github.com/nrkno/tv-automation-media-management)                                                                                                                                                                                                                                                                                                                                          | 1.7     |
