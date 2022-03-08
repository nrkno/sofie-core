import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Dictionary

:::info
Reading tip: [Concepts & Architecture](concepts-and-architecture.md)
:::

## Lobby

In the lobby, all existing rundowns are listed.

## Rundown View

The _Rundown View_ is the main view that the producer is working in.



![The Rundown view and naming conventions of components](/img/docs/main/sofie-naming-conventions.png)

### Segment Header Countdowns

![Each Segment has two clocks - the Segment Time Budget and a Segment Countdown](/img/docs/main/segment-budget-and-countdown.png)

<Tabs>
<TabItem value="segment-time-budget" label="Left: Segment Time Budget" default>
Clock on the left is an indicator of how much time has been spent playing Parts from that Segment in relation to how much time was planned for Parts in that Segment. If more time was spent playing than was planned for, this clock will turn red, there will be a **+** sign in front of it and will begin counting upwards.
</TabItem>

<TabItem value="segment-countdown" label="Right: Segment Countdown">
Clock on the right is a countdown to the beginning of a given segment. This takes into account unplayed time in the On Air Part and all unplayed Parts between the On Air Part and a given Segment. If there are no unplayed Parts between the On Air Part and the Segment, this counter will disappear.
</TabItem>
</Tabs>

In the illustration above, the first Segment \(_Ny Sak_\) has been playing for 4 minutes and 25 seconds longer than it was planned for. The second segment \(_Direkte Strømstad\)_ is planned to play for 4 minutes and 40 seconds. There are 5 minutes and 46 seconds worth of content between the current On Air line \(which is in the first Segment\) and the second Segment.

If you click on the Segment header countdowns, you can switch the _Segment Countdown_ to a _Segment OnAir Clock_ where this will show the time-of-day when a given Segment is expected to air.

![Each Segment has two clocks - the Segment Time Budget and a Segment Countdown](/img/docs/main/features/segment-header-2.png)

### Rundown Dividers

When using a workflow and blueprints that combine multiple NRCS Rundowns into a single Sofie Rundown \(such as when using the "Ready To Air" functionality in AP ENPS\), information about these individual NRCS Rundowns will be inserted into the Rundown View at the point where each of these incoming Rundowns start.

![Rundown divider between two NRCS Rundowns in a "Ready To Air" Rundown](/img/docs/main/rundown-divider.png)

For reference, these headers show the Name, Planned Start and Planned Duration of the individual NRCS Rundown.

### Shelf

The shelf contains lists of AdLibs that can be played out.

![Shelf](/img/docs/main/shelf.png)

:::info
The Shelf can be opened by clicking the handle at the bottom of the screen, or by pressing the TAB key
:::

### Sidebar Panel

#### Notification Center

:::caution
Documentation for this section is yet to be written.
:::

#### Switchboard

![Switchboard](/img/docs/main/switchboard.png)

The Switchboard allows the producer to turn automation _On_ and _Off_ for sets of devices, as well as re-route automation control between devices - both with an active rundown and when no rundown is active in a [Studio](/user-guide/concepts-and-architecture.md#system-organization-studio-and-show-style).

The Switchboard panel can be accessed from the Rundown View's right-hand Toolbar, by clicking on the Switchboard button, next to the Support panel button.

:::info
Technically, the switchboard activates and deactivates Route Sets. The Route Sets are grouped by Exclusivity Group. If an Exclusivity Group contains exactly two elements with the `ACTIVATE_ONLY` mode, the Route Sets will be displayed on either side of the switch. Otherwise, they will be displayed separately in a list next to an _Off_ position. See also [Settings ● Route sets](/user-guide/configuration/settings-view.md#route-sets).
:::

### Playing Things

![Take Next](/img/docs/main/take-next.png)

#### Take Point

The Take point is currently playing [Part](/user-guide/dictionary.md#part) in the rundown, indicated by the "On Air" line in the GUI.  
What's played on air is calculated from the timeline objects in the Pieces in the currently playing part.

The Pieces inside of a Part determines what's going to happen, the could be indicating things like VT:s, cut to cameras, graphics, or what script the host is going to read.

:::info
You can TAKE the next part by pressing _F12_ or the _Numpad Enter_ key.
:::

#### Next Point

The Next point is the next queued Part in the rundown. When the user clicks _Take_, the Next Part becomes the currently playing part, and the Next point is also moved.

:::info
Change the Next point by right-clicking in the GUI, or by pressing \(Shift +\) F9 & F10.
:::

#### Freeze-frame Countdown

![Part is 1 second heavy, LiveSpeak piece has 7 seconds of playback until it freezes](/img/docs/main/freeze-frame-countdown.png)

If a Piece has more or less content than the Part's expected duration allows, an additional counter with a Snowflake icon will be displayed, attached to the On Air line, counting down to the moment when content from that Piece will freeze-frame at the last frame. The time span in which the content from the Piece will be visible on the output, but will be frozen, is displayed with an overlay of icicles.

#### Lookahead

Elements in the [Next point](/user-guide/dictionary.md#next-point) \(or beyond\) might be pre-loaded or "put on preview", depending on the blueprints and playout devices used. This feature is called "Lookahead".

### Storyboard Mode

To the left side of the Zoom buttons, there's a button controlling the display style of a given Segment. The default display style of
a Segment can be indicated by the [Blueprints](/user-guide/concepts-and-architecture.md#blueprints), but the User can switch to
a different mode at any time.

![Storyboard Mode](/img/docs/main/storyboard.png)

The **_Storyboard_** mode is an alternative to the default **_Timeline_** mode. In Storyboard mode, the accurate placement in time of each Piece is not visualized, so that more Parts can be visualized at once. This can be particularly useful in Shows without very strict timing planning or where timing is not driven by the User, but rather some external factor; or in Shows where very long Parts are joined with very short ones: sports, events and debates. This mode also does not visualize the history of the playback: rather, it only shows what is currently On Air or is planned to go On Air.

Storyboard mode selects a "main" Piece of the Part, using the same logic as the [Presenter View](/user-guide/features/sofie-views.md#presenter-view), and presents it with a big, hover-scrub-enabled thumbnail for easy preview. The countdown to freeze-frame is displayed in the top-right hand corner of the Thumbnail, once less than 10 seconds remain to freeze-frame. The Transition Piece is displayed on top of the thumbnail. Other Pieces are placed below the thumbnail, stacked in order of playback. After a Piece goes off-air, it will dissapear from the view.

If no more Parts can be displayed in a given Segment, they are stacked in order on the right side of the Segment. The User can scroll through thse Parts by click-and-dragging the Storyboard area, or using the mouse wheel - `Alt`+Wheel, if only a vertical wheel is present in the mouse.

All user interactions work in the Storyboard mode the same as in Timeline mode: Takes, AdLibs, Holds and moving the [Next Point](#next-point) around the Rundown.

## Additional Views

Sofie features several separate views, such as the prompter, [read about them here](features/sofie-views.md).

![Prompter View](/img/docs/main/prompter-view.png)
