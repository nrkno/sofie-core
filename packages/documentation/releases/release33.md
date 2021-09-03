---
sidebar_label: v1.33 (2021-06-16)
sidebar_position: 1000
title: Release 33
---

Release date: 2021-06-16 \(1.33.0\)

### Main Features

- Support of inputting basic arrays in settings
- Filter out duplicate ad libs
- Human readable layer names for use in UI's
- Blueprints can now upload static assets to core to be used as icons and previews in the UI'
  - Note that this introduces a breaking change in the blueprint ingest API
- Translatable adlib actions
- Various other Blueprint API improvements
- Introduction of expected playout items
- Staggered UI updates improving UI performance
- Playout gateway can upload short clips to Blackmagic Atem Switchers

### Components

| Component                                                                                                                                                                                                                                                                                                                                                                                                         | Version |
| :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------ |
| [Core](https://github.com/nrkno/tv-automation-server-core) <br/> [Blueprints API ( Core )](https://www.npmjs.com/package/@sofie-automation/blueprints-integration)<br/>[Gateway API](https://www.npmjs.com/package/@sofie-automation/server-core-integration)<br/>[Mos Gateway](https://github.com/nrkno/tv-automation-mos-gateway)<br/>[Playout Gateway](https://github.com/nrkno/tv-automation-playout-gateway) | 1.33    |
| [Blueprints API ( TSR )](https://www.npmjs.com/package/timeline-state-resolver)                                                                                                                                                                                                                                                                                                                                   | 5.8     |
| [Media Manager](https://github.com/nrkno/tv-automation-media-management)                                                                                                                                                                                                                                                                                                                                          | 1.8     |
