---
sidebar_position: 6
---

# Sofie views

## Rundown View
![Rundown View](/img/docs/main/features-and-configuration/active-rundown-example.png)

### Shelf layouts

The Rundown view and the Detached Shelf view UI can have multiple concurrent layouts for any given Show Style. The automatic selection mechanism works as follows:

1. select the first layout of the `RUNDOWN_LAYOUT` type,
2. select the first layout of any type,
3. use the default layout \(no additional filters\), in the style of `RUNDOWN_LAYOUT`.

To use a specific layout in these views, you can use the `?layout=...` query string, providing either the ID of the layout or a part of the name. This string will then be mached against all available layouts for the Show Style, and the first matching will be selected. For example, for a layout called `Stream Deck layout`, to open the currently active rundown's Detached Shelf use:

`http://localhost:3000/activeRundown/studio0/shelf?layout=Stream`

The Detached Shelf view with a custom `DASHBOARD_LAYOUT` allows displaying the Shelf on an auxiliary touch screen, tablet or a Stream Deck device. A specialized Stream Deck view will be used if the view is opened on a device with hardware characteristics matching a Stream Deck device.

The shelf also contains additional elements, not controlled by the Rundown View Layout. These include Buckets and the Inspector. If needed, these components can be displayed or hidden using additional url arguments:

| Query parameter | Description |
| :--- | :--- |
| Default | Display the rundown layout \(as selected\), all buckets and the inspector |
| `?display=layout,buckets,inspector` | A comma-separated list of features to be displayed in the shelf |
| `?buckets=0,1,...` | A comma-separated list of buckets to be displayed |

* `display`: Available values are: `layout` \(for displaying the Rundown Layout\), `buckets` \(for displaying the Buckets\) and `inspector` \(for displaying the Inspector\).
* `buckets`: The buckets can be specified as base-0 indices of the buckets as seen by the user. This means that `?buckets=1` will display the second bucket as seen by the user when not filtering the buckets. This allows the user to decide which bucket is displayed on a secondary attached screen simply by reordering the buckets on their main view.

_Note: the Inspector is limited in scope to a particular browser window/screen, so do not expect the contents of the inspector to sync across multiple screens._



For the purpose of running the system in a studio environment, there are some additional views that can be used for various purposes:

## Prompter

`/prompter/:studioId`

![Prompter View](/img/docs/main/features-and-configuration/prompter-example.png)

A fullscreen page which displays the prompter text for the currently active rundown. The prompter can be controlled and configured in various ways, see more at the [Prompter](prompter.md) documentation. If no Rundown is active in a given studio, the [Screensaver](sofie-pages.md#screensaver) will be displayed. 

A full-screen page which displays the prompter text for the currently active rundown. The prompter can be controlled and configured in various ways, see more at the [Prompter](prompter.md) documentation.

## Presenter screen

`/countdowns/:studioId/presenter`

![Presenter Screen](/img/docs/main/features-and-configuration/presenter-screen-example.png)

A full-screen page, intended to be shown to the studio presenter. It displays countdown timers for the current and next items in the rundown. If no Rundown is active in a given studio, the [Screensaver](sofie-pages.md#screensaver) will be shown.

### Presenter screen overlay

![Presenter Screen Overlay](/img/docs/main/features-and-configuration/presenter-screen-overlay-example.png)

A full-screen page with transparent background, intended to be shown to the studio presenter as an overlay on top of the produced PGM signal. It displays a reduced amount of the information from the regular [Presenter screen](sofie-pages.md#presenter-screen): the countdown to the end of the current Part, a summary preview \(type and name\) of the next item in the Rundown and the current time of day. If no Rundown is active it will show the name of the Studio.

## Active Rundown View

`/activeRundown/:studioId`

![Active Rundown](/img/docs/main/features-and-configuration/active-rundown-example.png)

A page which automatically displays the currently active rundown. Can be useful for the producer to have on a secondary screen.

## Active Rundown – Shelf

`/activeRundown/:studioId/shelf`

![Active Rundown Shelf](/img/docs/main/features-and-configuration/active-rundown-shelf-example.png)

A page which automatically displays the currently active rundown, and shows the Shelf in full screen. Can be useful for the producer to have on a secondary screen.

A shelf layout can be selected by modifying the query string, see [Shelf layout](shelf-layout).

## Specific rundown - shelf

`/rundown/:rundownId/shelf`

Displays the shelf in fullscreen for a rundown

## Screensaver

When big screen displays \(like Prompter and the Presenter screen\) do not have any meaningful content to show, an animated screensaver showing the current time and the next planned show will be displayed. If no Rundown is upcoming, the Studio name will be displayed.

![A screensaver showing the next scheduled show](/img/docs/main/features-and-configuration/next-scheduled-show-example.png)



