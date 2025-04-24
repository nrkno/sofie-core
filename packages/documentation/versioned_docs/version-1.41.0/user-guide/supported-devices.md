---
sidebar_position: 4
---

# Supported Playout Devices

All playout devices are essentially driven through the _timeline_, which passes through _Sofie&nbsp;Core_ into the Playout Gateway where it is processed by the timeline-state-resolver. This page details which devices and what parts of the devices can be controlled through the timeline-state-resolver library. In general a blueprints developer can use the [timeline-state-resolver-types package](https://www.npmjs.com/package/timeline-state-resolver-types) to see the interfaces for the timeline objects used to control the devices.

## Blackmagic Design's ATEM Vision Mixers <a id="blackmagic-design-atem-vision-mixers"></a>

We support almost all features of these devices except fairlight audio, camera controls and streaming capabilities. A non-inclusive list:

- Control of camera inputs
- Transitions
- Full control of keyers
- Full control of DVE's
- Control of media pools
- Control of auxilliaries

## CasparCG&nbsp;Server<a id="casparcg"></a>

Tested and developed against [a fork of version 2.1](https://github.com/nrkno/sofie-casparcg-server) with more support for version 2.3 being added in the future.

- Video playback
- Graphics playback
- Recording / streaming
- Mixer parameters
- Transitions

## HTTP Protocol <a id="http-protocol"></a>

- Get/post/put/delete methods
- Interval based watcher for status monitoring

## Blackmagic Design HyperDeck <a id="blackmagic-design-hyperdeck"></a>

- Recording

## Lawo Powercore & MC2 Series <a id="lawo-powercore-and-mc2-series"></a>

- Control over faders
  - Using the ramp function on the powercore
- Control of parameters in the ember tree

## OSC protocol <a id="osc-protocol"></a>

- Sending of integers, floats, strings, blobs
- Tweening \(transitioning between\) values

Can be configured in TCP or UDP mode.

## Panasonic PTZ Cameras <a id="panasonic-ptz-cameras"></a>

- Recalling presets
- Setting zoom, zoom speed and recall speed

## Pharos Lighting Control <a id="pharos-lighting-control"></a>

- Recalling scenes
- Recalling timelines

## Grass Valley SQ Media Servers <a id="grass-valley-sq-media-servers"></a>

- Control of playback
- Looping
- Cloning

_Note: some features are controlled through the media-manager_

## Shotoku Camera Robotics <a id="shotoku-camera-robotics"></a>

- Cutting to shots
- Fading to shots

## Singular Live <a id="singular-live"></a>

- Control nodes

_Note: this is not currently used in production by anyone we know of_

## Sisyfos <a id="sisyfos"></a>

- On-air controls
- Fader levels
- Labels
- Hide / show channels

## TCP Protocol <a id="tcp-protocol"></a>

- Sending messages

## VizRT Viz MSE <a id="vizrt-viz-mse"></a>

- Pilot elements
- Continue commands
- Loading all elements
- Clearing all elements

## vMix <a id="vmix"></a>

- Full M/E control
- Audio control
- Streaming / recording control
- Fade to black
- Overlays
- Transforms
- Transitions
