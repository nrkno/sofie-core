---
sidebar_position: 2
---

# Sofie Views

## Rundown View
![Rundown View](/img/docs/main/features/active-rundown-example.png)

### Shelf Layouts

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

## Prompter View

`/prompter/:studioId`

![Prompter View](/img/docs/main/features/prompter-example.png)

A fullscreen page which displays the prompter text for the currently active rundown. The prompter can be controlled and configured in various ways, see more at the [Prompter](prompter) documentation. If no Rundown is active in a given studio, the [Screensaver](sofie-views#screensaver) will be displayed. 

A full-screen page which displays the prompter text for the currently active rundown. The prompter can be controlled and configured in various ways, see more at the [Prompter](prompter) documentation.

## Presenter View

`/countdowns/:studioId/presenter`

![Presenter View](/img/docs/main/features/presenter-screen-example.png)

A full-screen page, intended to be shown to the studio presenter. It displays countdown timers for the current and next items in the rundown. If no Rundown is active in a given studio, the [Screensaver](sofie-views#screensaver) will be shown.

### Presenter View Overlay

![Presenter View Overlay](/img/docs/main/features/presenter-screen-overlay-example.png)

A fullscreen view with transparent background, intended to be shown to the studio presenter as an overlay on top of the produced PGM signal. It displays a reduced amount of the information from the regular [Presenter screen](sofie-views#presenter-view): the countdown to the end of the current Part, a summary preview \(type and name\) of the next item in the Rundown and the current time of day. If no Rundown is active it will show the name of the Studio.

## Active Rundown View

`/activeRundown/:studioId`

![Active Rundown View](/img/docs/main/features/active-rundown-example.png)

A page which automatically displays the currently active rundown. Can be useful for the producer to have on a secondary screen.

## Active Rundown – Shelf

`/activeRundown/:studioId/shelf`

![Active Rundown Shelf](/img/docs/main/features/active-rundown-shelf-example.png)

A view which automatically displays the currently active rundown, and shows the Shelf in full screen. Can be useful for the producer to have on a secondary screen.

A shelf layout can be selected by modifying the query string, see [Shelf Layouts](#shelf-layouts).

## Specific Rundown - Shelf

`/rundown/:rundownId/shelf`

Displays the shelf in fullscreen for a rundown

## Screensaver

When big screen displays \(like Prompter and the Presenter screen\) do not have any meaningful content to show, an animated screensaver showing the current time and the next planned show will be displayed. If no Rundown is upcoming, the Studio name will be displayed.

![A screensaver showing the next scheduled show](/img/docs/main/features/next-scheduled-show-example.png)


## System Status

:::caution
Documentation for this feature is yet to be written.
:::

System and devices statuses are displayed here.


:::info
An API endpoint for the system status is also available under the URL `/health`
:::

## Media Status View

:::caution
Documentation for this feature is yet to be written.
:::

This page displays media transfer statuses.



## Message Queue View

:::caution
Documentation for this feature is yet to be written.
:::

_Sofie&nbsp;Core_ can send messages to external systems \(such as metadata, as-run-logs\) while on air.

These messages are retained for a period of time, and can be reviewed in this list.

Messages that was not successfully sent can be inspected and re-sent here.



## User Log View

The user activity log contains a list of the user-actions that users have previously done. This is used in troubleshooting issues on-air.

![User Log](/img/docs/main/features/user-log.png)

### Columns, explained

#### Execution time

The execution time column displays **coreDuration** + **gatewayDuration** \(**timelineResolveDuration**\)":

* **coreDuration** : The time it took for Core to execute the command \(ie start-of-command 🠺 stored-result-into-database\)
*  **gatewayDuration** : The time it took for Playout Gateway to execute the timeline \(ie stored-result-into-database 🠺 timeline-resolved 🠺 callback-to-core\)
* **timelineResolveDuration**: The duration it took in TSR \(in Playout Gateway\) to resolve the timeline

Important to note is that **gatewayDuration** begins at the exact moment **coreDuration** ends.  
So **coreDuration + gatewayDuration** is the full time it took from beginning-of-user-action to the timeline-resolved \(plus a little extra for the final callback for reporting the measurement\).

#### Action

Describes what action the user did; e g pressed a key, clicked a button, or selected a meny item.

#### Method

The internal name in _Sofie&nbsp;Core_ of what function was called

#### Status

The result of the operation. "Success" or an error message.



## Evaluations
When a broadcast is done, users can input feedback about how the show went in an evaluation form.

:::info
Evaluations can be configured to be sent to Slack, by setting the "Slack Webhook URL" under Settings/Studio
:::
