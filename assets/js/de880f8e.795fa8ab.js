"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[3029],{3382:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>l,default:()=>p,frontMatter:()=>o,metadata:()=>d,toc:()=>h});var i=t(62540),s=t(43023),r=t(78296),a=t(22491);const o={sidebar_position:2},l="Sofie Views",d={id:"user-guide/features/sofie-views",title:"Sofie Views",description:"Lobby View",source:"@site/versioned_docs/version-1.49.0/user-guide/features/sofie-views.mdx",sourceDirName:"user-guide/features",slug:"/user-guide/features/sofie-views",permalink:"/sofie-core/docs/1.49.0/user-guide/features/sofie-views",draft:!1,unlisted:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.49.0/user-guide/features/sofie-views.mdx",tags:[],version:"1.49.0",sidebarPosition:2,frontMatter:{sidebar_position:2},sidebar:"userGuide",previous:{title:"Supported Playout Devices",permalink:"/sofie-core/docs/1.49.0/user-guide/supported-devices"},next:{title:"Access Levels",permalink:"/sofie-core/docs/1.49.0/user-guide/features/access-levels"}},c={},h=[{value:"Lobby View",id:"lobby-view",level:2},{value:"Rundown View",id:"rundown-view",level:2},{value:"Take Point",id:"take-point",level:4},{value:"Next Point",id:"next-point",level:4},{value:"Freeze-frame Countdown",id:"freeze-frame-countdown",level:4},{value:"Lookahead",id:"lookahead",level:4},{value:"Storyboard Mode",id:"storyboard-mode",level:3},{value:"List View Mode",id:"list-view-mode",level:3},{value:"Segment Header Countdowns",id:"segment-header-countdowns",level:3},{value:"Rundown Dividers",id:"rundown-dividers",level:3},{value:"Shelf",id:"shelf",level:3},{value:"Shelf Layouts",id:"shelf-layouts",level:3},{value:"Sidebar Panel",id:"sidebar-panel",level:3},{value:"Switchboard",id:"switchboard",level:4},{value:"Prompter View",id:"prompter-view",level:2},{value:"Presenter View",id:"presenter-view",level:2},{value:"Presenter View Overlay",id:"presenter-view-overlay",level:3},{value:"Active Rundown View",id:"active-rundown-view",level:2},{value:"Active Rundown \u2013 Shelf",id:"active-rundown--shelf",level:2},{value:"Specific Rundown \u2013 Shelf",id:"specific-rundown--shelf",level:2},{value:"Screensaver",id:"screensaver",level:2},{value:"System Status",id:"system-status",level:2},{value:"Media Status View",id:"media-status-view",level:2},{value:"Message Queue View",id:"message-queue-view",level:2},{value:"User Log View",id:"user-log-view",level:2},{value:"Columns, explained",id:"columns-explained",level:3},{value:"Execution time",id:"execution-time",level:4},{value:"Action",id:"action",level:4},{value:"Method",id:"method",level:4},{value:"Status",id:"status",level:4},{value:"Evaluations",id:"evaluations",level:2},{value:"Settings View",id:"settings-view",level:2}];function u(e){const n={a:"a",admonition:"admonition",br:"br",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",h4:"h4",img:"img",li:"li",ol:"ol",p:"p",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...(0,s.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.h1,{id:"sofie-views",children:"Sofie Views"}),"\n",(0,i.jsx)(n.h2,{id:"lobby-view",children:"Lobby View"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Rundown View",src:t(46205).A+"",width:"2332",height:"1532"})}),"\n",(0,i.jsxs)(n.p,{children:["All existing rundowns are listed in the ",(0,i.jsx)(n.em,{children:"Lobby View"}),"."]}),"\n",(0,i.jsx)(n.h2,{id:"rundown-view",children:"Rundown View"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Rundown View",src:t(90670).A+"",width:"500",height:"288"})}),"\n",(0,i.jsxs)(n.p,{children:["The ",(0,i.jsx)(n.em,{children:"Rundown View"})," is the main view that the producer is working in."]}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"The Rundown view and naming conventions of components",src:t(31909).A+"",width:"957",height:"529"})}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Take Next",src:t(20256).A+"",width:"1122",height:"366"})}),"\n",(0,i.jsx)(n.h4,{id:"take-point",children:"Take Point"}),"\n",(0,i.jsxs)(n.p,{children:["The Take point is currently playing ",(0,i.jsx)(n.a,{href:"#part",children:"Part"}),' in the rundown, indicated by the "On Air" line in the GUI.',(0,i.jsx)(n.br,{}),"\n","What's played on air is calculated from the timeline objects in the Pieces in the currently playing part."]}),"\n",(0,i.jsxs)(n.p,{children:["The Pieces inside of a Part determines what's going to happen, the could be indicating things like VT",":s",", cut to cameras, graphics, or what script the host is going to read."]}),"\n",(0,i.jsx)(n.admonition,{type:"info",children:(0,i.jsxs)(n.p,{children:["You can TAKE the next part by pressing ",(0,i.jsx)(n.em,{children:"F12"})," or the ",(0,i.jsx)(n.em,{children:"Numpad Enter"})," key."]})}),"\n",(0,i.jsx)(n.h4,{id:"next-point",children:"Next Point"}),"\n",(0,i.jsxs)(n.p,{children:["The Next point is the next queued Part in the rundown. When the user clicks ",(0,i.jsx)(n.em,{children:"Take"}),", the Next Part becomes the currently playing part, and the Next point is also moved."]}),"\n",(0,i.jsx)(n.admonition,{type:"info",children:(0,i.jsx)(n.p,{children:"Change the Next point by right-clicking in the GUI, or by pressing (Shift +) F9 & F10."})}),"\n",(0,i.jsx)(n.h4,{id:"freeze-frame-countdown",children:"Freeze-frame Countdown"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Part is 1 second heavy, LiveSpeak piece has 7 seconds of playback until it freezes",src:t(6162).A+"",width:"374",height:"327"})}),"\n",(0,i.jsx)(n.p,{children:"If a Piece has more or less content than the Part's expected duration allows, an additional counter with a Snowflake icon will be displayed, attached to the On Air line, counting down to the moment when content from that Piece will freeze-frame at the last frame. The time span in which the content from the Piece will be visible on the output, but will be frozen, is displayed with an overlay of icicles."}),"\n",(0,i.jsx)(n.h4,{id:"lookahead",children:"Lookahead"}),"\n",(0,i.jsxs)(n.p,{children:["Elements in the ",(0,i.jsx)(n.a,{href:"#next-point",children:"Next point"}),' (or beyond) might be pre-loaded or "put on preview", depending on the blueprints and playout devices used. This feature is called "Lookahead".']}),"\n",(0,i.jsx)(n.h3,{id:"storyboard-mode",children:"Storyboard Mode"}),"\n",(0,i.jsxs)(n.p,{children:["In the top-right corner of the Segment, there's a button controlling the display style of a given Segment. The default display style of a Segment can be indicated by the ",(0,i.jsx)(n.a,{href:"/sofie-core/docs/1.49.0/user-guide/concepts-and-architecture#blueprints",children:"Blueprints"}),", but the User can switch to a different mode at any time. You can also change the display mode of all Segments at once, using a button in the bottom-right corner of the Rundown View."]}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Storyboard Mode",src:t(2864).A+"",width:"1805",height:"320"})}),"\n",(0,i.jsxs)(n.p,{children:["The ",(0,i.jsx)(n.strong,{children:(0,i.jsx)(n.em,{children:"Storyboard"})})," mode is an alternative to the default ",(0,i.jsx)(n.strong,{children:(0,i.jsx)(n.em,{children:"Timeline"})})," mode. In Storyboard mode, the accurate placement in time of each Piece is not visualized, so that more Parts can be visualized at once in a single row. This can be particularly useful in Shows without very strict timing planning or where timing is not driven by the User, but rather some external factor; or in Shows where very long Parts are joined with very short ones: sports, events and debates. This mode also does not visualize the history of the playback: rather, it only shows what is currently On Air or is planned to go On Air."]}),"\n",(0,i.jsxs)(n.p,{children:['Storyboard mode selects a "main" Piece of the Part, using the same logic as the ',(0,i.jsx)(n.a,{href:"#presenter-view",children:"Presenter View"}),", and presents it with a larger, hover-scrub-enabled Piece for easy preview. The countdown to freeze-frame is displayed in the top-right hand corner of the Thumbnail, once less than 10 seconds remain to freeze-frame. The Transition Piece is displayed on top of the thumbnail. Other Pieces are placed below the thumbnail, stacked in order of playback. After a Piece goes off-air, it will dissapear from the view."]}),"\n",(0,i.jsxs)(n.p,{children:["If no more Parts can be displayed in a given Segment, they are stacked in order on the right side of the Segment. The User can scroll through thse Parts by click-and-dragging the Storyboard area, or using the mouse wheel - ",(0,i.jsx)(n.code,{children:"Alt"}),"+Wheel, if only a vertical wheel is present in the mouse."]}),"\n",(0,i.jsx)(n.h3,{id:"list-view-mode",children:"List View Mode"}),"\n",(0,i.jsxs)(n.p,{children:["Another mode available to display a Segment is the List View. In this mode, each ",(0,i.jsx)(n.em,{children:"Part"})," and it's contents are being displayed as a mini-timeline and it's width is normalized to fit the screen, unless it's shorter than 30 seconds, in which case it will be scaled down accordingly."]}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"List View Mode",src:t(77789).A+"",width:"1842",height:"360"})}),"\n",(0,i.jsxs)(n.p,{children:['In this mode, the focus is on the "main" Piece of the Part. Additional ',(0,i.jsx)(n.em,{children:"Lower-Third"})," content that is not spanning the entire Part (is not infinite) will be displayed on top of the main Piece. All other content can be displayed to the right of the mini-timeline as a set of indicators, one per every Layer. Clicking on those indicators will show a pop-up with the Pieces so that they can be investigated using ",(0,i.jsx)(n.em,{children:"hover-scrub"}),". Indicators can be also shown for Ad-Libs assigned to a Part, for easier discovery by the User. Which Layers should be shown in the columns can be decided in the ",(0,i.jsx)(n.a,{href:"/sofie-core/docs/1.49.0/user-guide/configuration/settings-view#show-style",children:"Settings \u25cf Layers"})," area. A special, larger indicator is reserved for the Script piece, which can be useful to display so-called ",(0,i.jsx)(n.em,{children:"out-words"}),"."]}),"\n",(0,i.jsxs)(n.p,{children:["If a Part has an ",(0,i.jsx)(n.em,{children:"in-transition"})," Piece, it will be displayed to the left of the Part's Take Point."]}),"\n",(0,i.jsxs)(n.p,{children:["This view is designed to be used in productions that are mixing pre-planned and timed segments with more free-flowing production or mixing short live in-camera links with longer pre-produced clips, while trying to keep as much of the show in the viewport as possible, at the expense of hiding some of the content from the User and the ",(0,i.jsx)(n.em,{children:"duration"})," of the Part on screen having no bearing on it's ",(0,i.jsx)(n.em,{children:"width"}),". This mode also allows Sofie to visualize content ",(0,i.jsx)(n.em,{children:"beyond"})," the planned duration of a Part."]}),"\n",(0,i.jsx)(n.admonition,{type:"info",children:(0,i.jsxs)(n.p,{children:["The Segment header area also shows the expected (planned) durations for all the Parts and will also show which Parts are sharing timing in a timing group using a ",(0,i.jsx)(n.em,{children:"\u230a"})," symbol in the place of a counter."]})}),"\n",(0,i.jsxs)(n.p,{children:["All user interactions work in the Storyboard and List View mode the same as in Timeline mode: Takes, AdLibs, Holds and moving the ",(0,i.jsx)(n.a,{href:"#next-point",children:"Next Point"})," around the Rundown."]}),"\n",(0,i.jsx)(n.h3,{id:"segment-header-countdowns",children:"Segment Header Countdowns"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Each Segment has two clocks - the Segment Time Budget and a Segment Countdown",src:t(60908).A+"",width:"277",height:"477"})}),"\n",(0,i.jsxs)(r.A,{children:[(0,i.jsx)(a.A,{value:"segment-time-budget",label:"Left: Segment Time Budget",default:!0,children:(0,i.jsxs)(n.p,{children:["Clock on the left is an indicator of how much time has been spent playing Parts from that Segment in relation to how much time was planned for Parts in that Segment. If more time was spent playing than was planned for, this clock will turn red, there will be a ",(0,i.jsx)(n.strong,{children:"+"})," sign in front of it and will begin counting upwards."]})}),(0,i.jsx)(a.A,{value:"segment-countdown",label:"Right: Segment Countdown",children:(0,i.jsx)(n.p,{children:"Clock on the right is a countdown to the beginning of a given segment. This takes into account unplayed time in the On Air Part and all unplayed Parts between the On Air Part and a given Segment. If there are no unplayed Parts between the On Air Part and the Segment, this counter will disappear."})})]}),"\n",(0,i.jsxs)(n.p,{children:["In the illustration above, the first Segment (",(0,i.jsx)(n.em,{children:"Ny Sak"}),") has been playing for 4 minutes and 25 seconds longer than it was planned for. The second segment (",(0,i.jsx)(n.em,{children:"Direkte Str\xf8mstad)"})," is planned to play for 4 minutes and 40 seconds. There are 5 minutes and 46 seconds worth of content between the current On Air line (which is in the first Segment) and the second Segment."]}),"\n",(0,i.jsxs)(n.p,{children:["If you click on the Segment header countdowns, you can switch the ",(0,i.jsx)(n.em,{children:"Segment Countdown"})," to a ",(0,i.jsx)(n.em,{children:"Segment OnAir Clock"})," where this will show the time-of-day when a given Segment is expected to air."]}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Each Segment has two clocks - the Segment Time Budget and a Segment Countdown",src:t(95851).A+"",width:"287",height:"255"})}),"\n",(0,i.jsx)(n.h3,{id:"rundown-dividers",children:"Rundown Dividers"}),"\n",(0,i.jsx)(n.p,{children:'When using a workflow and blueprints that combine multiple NRCS Rundowns into a single Sofie Rundown (such as when using the "Ready To Air" functionality in AP ENPS), information about these individual NRCS Rundowns will be inserted into the Rundown View at the point where each of these incoming Rundowns start.'}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Rundown divider between two NRCS Rundowns in a &quot;Ready To Air&quot; Rundown",src:t(8422).A+"",width:"1823",height:"421"})}),"\n",(0,i.jsx)(n.p,{children:"For reference, these headers show the Name, Planned Start and Planned Duration of the individual NRCS Rundown."}),"\n",(0,i.jsx)(n.h3,{id:"shelf",children:"Shelf"}),"\n",(0,i.jsx)(n.p,{children:"The shelf contains lists of AdLibs that can be played out."}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Shelf",src:t(61881).A+"",width:"274",height:"151"})}),"\n",(0,i.jsx)(n.admonition,{type:"info",children:(0,i.jsx)(n.p,{children:"The Shelf can be opened by clicking the handle at the bottom of the screen, or by pressing the TAB key"})}),"\n",(0,i.jsx)(n.h3,{id:"shelf-layouts",children:"Shelf Layouts"}),"\n",(0,i.jsxs)(n.p,{children:["The ",(0,i.jsx)(n.em,{children:"Rundown View"})," and the ",(0,i.jsx)(n.em,{children:"Detached Shelf View"})," UI can have multiple concurrent layouts for any given Show Style. The automatic selection mechanism works as follows:"]}),"\n",(0,i.jsxs)(n.ol,{children:["\n",(0,i.jsxs)(n.li,{children:["select the first layout of the ",(0,i.jsx)(n.code,{children:"RUNDOWN_LAYOUT"})," type,"]}),"\n",(0,i.jsx)(n.li,{children:"select the first layout of any type,"}),"\n",(0,i.jsxs)(n.li,{children:["use the default layout (no additional filters), in the style of ",(0,i.jsx)(n.code,{children:"RUNDOWN_LAYOUT"}),"."]}),"\n"]}),"\n",(0,i.jsxs)(n.p,{children:["To use a specific layout in these views, you can use the ",(0,i.jsx)(n.code,{children:"?layout=..."})," query string, providing either the ID of the layout or a part of the name. This string will then be mached against all available layouts for the Show Style, and the first matching will be selected. For example, for a layout called ",(0,i.jsx)(n.code,{children:"Stream Deck layout"}),", to open the currently active rundown's Detached Shelf use:"]}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"http://localhost:3000/activeRundown/studio0/shelf?layout=Stream"})}),"\n",(0,i.jsxs)(n.p,{children:["The Detached Shelf view with a custom ",(0,i.jsx)(n.code,{children:"DASHBOARD_LAYOUT"})," allows displaying the Shelf on an auxiliary touch screen, tablet or a Stream Deck device. A specialized Stream Deck view will be used if the view is opened on a device with hardware characteristics matching a Stream Deck device."]}),"\n",(0,i.jsx)(n.p,{children:"The shelf also contains additional elements, not controlled by the Rundown View Layout. These include Buckets and the Inspector. If needed, these components can be displayed or hidden using additional url arguments:"}),"\n",(0,i.jsxs)(n.table,{children:[(0,i.jsx)(n.thead,{children:(0,i.jsxs)(n.tr,{children:[(0,i.jsx)(n.th,{style:{textAlign:"left"},children:"Query parameter"}),(0,i.jsx)(n.th,{style:{textAlign:"left"},children:"Description"})]})}),(0,i.jsxs)(n.tbody,{children:[(0,i.jsxs)(n.tr,{children:[(0,i.jsx)(n.td,{style:{textAlign:"left"},children:"Default"}),(0,i.jsx)(n.td,{style:{textAlign:"left"},children:"Display the rundown layout (as selected), all buckets and the inspector"})]}),(0,i.jsxs)(n.tr,{children:[(0,i.jsx)(n.td,{style:{textAlign:"left"},children:(0,i.jsx)(n.code,{children:"?display=layout,buckets,inspector"})}),(0,i.jsx)(n.td,{style:{textAlign:"left"},children:"A comma-separated list of features to be displayed in the shelf"})]}),(0,i.jsxs)(n.tr,{children:[(0,i.jsx)(n.td,{style:{textAlign:"left"},children:(0,i.jsx)(n.code,{children:"?buckets=0,1,..."})}),(0,i.jsx)(n.td,{style:{textAlign:"left"},children:"A comma-separated list of buckets to be displayed"})]})]})]}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.code,{children:"display"}),": Available values are: ",(0,i.jsx)(n.code,{children:"layout"})," (for displaying the Rundown Layout), ",(0,i.jsx)(n.code,{children:"buckets"})," (for displaying the Buckets) and ",(0,i.jsx)(n.code,{children:"inspector"})," (for displaying the Inspector)."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.code,{children:"buckets"}),": The buckets can be specified as base-0 indices of the buckets as seen by the user. This means that ",(0,i.jsx)(n.code,{children:"?buckets=1"})," will display the second bucket as seen by the user when not filtering the buckets. This allows the user to decide which bucket is displayed on a secondary attached screen simply by reordering the buckets on their main view."]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.em,{children:"Note: the Inspector is limited in scope to a particular browser window/screen, so do not expect the contents of the inspector to sync across multiple screens."})}),"\n",(0,i.jsx)(n.p,{children:"For the purpose of running the system in a studio environment, there are some additional views that can be used for various purposes:"}),"\n",(0,i.jsx)(n.h3,{id:"sidebar-panel",children:"Sidebar Panel"}),"\n",(0,i.jsx)(n.h4,{id:"switchboard",children:"Switchboard"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Switchboard",src:t(32049).A+"",width:"744",height:"403"})}),"\n",(0,i.jsxs)(n.p,{children:["The Switchboard allows the producer to turn automation ",(0,i.jsx)(n.em,{children:"On"})," and ",(0,i.jsx)(n.em,{children:"Off"})," for sets of devices, as well as re-route automation control between devices - both with an active rundown and when no rundown is active in a ",(0,i.jsx)(n.a,{href:"/sofie-core/docs/1.49.0/user-guide/concepts-and-architecture#system-organization-studio-and-show-style",children:"Studio"}),"."]}),"\n",(0,i.jsx)(n.p,{children:"The Switchboard panel can be accessed from the Rundown View's right-hand Toolbar, by clicking on the Switchboard button, next to the Support panel button."}),"\n",(0,i.jsx)(n.admonition,{type:"info",children:(0,i.jsxs)(n.p,{children:["Technically, the switchboard activates and deactivates Route Sets. The Route Sets are grouped by Exclusivity Group. If an Exclusivity Group contains exactly two elements with the ",(0,i.jsx)(n.code,{children:"ACTIVATE_ONLY"})," mode, the Route Sets will be displayed on either side of the switch. Otherwise, they will be displayed separately in a list next to an ",(0,i.jsx)(n.em,{children:"Off"})," position. See also ",(0,i.jsx)(n.a,{href:"../configuration/settings-view#route-sets",children:"Settings \u25cf Route sets"}),"."]})}),"\n",(0,i.jsx)(n.h2,{id:"prompter-view",children:"Prompter View"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"/prompter/:studioId"})}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Prompter View",src:t(11475).A+"",width:"1920",height:"1080"})}),"\n",(0,i.jsxs)(n.p,{children:["A fullscreen page which displays the prompter text for the currently active rundown. The prompter can be controlled and configured in various ways, see more at the ",(0,i.jsx)(n.a,{href:"/sofie-core/docs/1.49.0/user-guide/features/prompter",children:"Prompter"})," documentation. If no Rundown is active in a given studio, the ",(0,i.jsx)(n.a,{href:"/sofie-core/docs/1.49.0/user-guide/features/sofie-views#screensaver",children:"Screensaver"})," will be displayed."]}),"\n",(0,i.jsx)(n.h2,{id:"presenter-view",children:"Presenter View"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"/countdowns/:studioId/presenter"})}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Presenter View",src:t(21553).A+"",width:"400",height:"231"})}),"\n",(0,i.jsxs)(n.p,{children:["A fullscreen page, intended to be shown to the studio presenter. It displays countdown timers for the current and next items in the rundown. If no Rundown is active in a given studio, the ",(0,i.jsx)(n.a,{href:"/sofie-core/docs/1.49.0/user-guide/features/sofie-views#screensaver",children:"Screensaver"})," will be shown."]}),"\n",(0,i.jsx)(n.h3,{id:"presenter-view-overlay",children:"Presenter View Overlay"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"/countdowns/:studioId/overlay"})}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Presenter View Overlay",src:t(26534).A+"",width:"1471",height:"847"})}),"\n",(0,i.jsxs)(n.p,{children:["A fullscreen view with transparent background, intended to be shown to the studio presenter as an overlay on top of the produced PGM signal. It displays a reduced amount of the information from the regular ",(0,i.jsx)(n.a,{href:"/sofie-core/docs/1.49.0/user-guide/features/sofie-views#presenter-view",children:"Presenter screen"}),": the countdown to the end of the current Part, a summary preview (type and name) of the next item in the Rundown and the current time of day. If no Rundown is active it will show the name of the Studio."]}),"\n",(0,i.jsx)(n.h2,{id:"active-rundown-view",children:"Active Rundown View"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"/activeRundown/:studioId"})}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Active Rundown View",src:t(90670).A+"",width:"500",height:"288"})}),"\n",(0,i.jsx)(n.p,{children:"A page which automatically displays the currently active rundown. Can be useful for the producer to have on a secondary screen."}),"\n",(0,i.jsx)(n.h2,{id:"active-rundown--shelf",children:"Active Rundown \u2013 Shelf"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"/activeRundown/:studioId/shelf"})}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Active Rundown Shelf",src:t(79829).A+"",width:"500",height:"288"})}),"\n",(0,i.jsx)(n.p,{children:"A view which automatically displays the currently active rundown, and shows the Shelf in full screen. Can be useful for the producer to have on a secondary screen."}),"\n",(0,i.jsxs)(n.p,{children:["A shelf layout can be selected by modifying the query string, see ",(0,i.jsx)(n.a,{href:"#shelf-layouts",children:"Shelf Layouts"}),"."]}),"\n",(0,i.jsx)(n.h2,{id:"specific-rundown--shelf",children:"Specific Rundown \u2013 Shelf"}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.code,{children:"/rundown/:rundownId/shelf"})}),"\n",(0,i.jsx)(n.p,{children:"Displays the shelf in fullscreen for a rundown"}),"\n",(0,i.jsx)(n.h2,{id:"screensaver",children:"Screensaver"}),"\n",(0,i.jsx)(n.p,{children:"When big screen displays (like Prompter and the Presenter screen) do not have any meaningful content to show, an animated screensaver showing the current time and the next planned show will be displayed. If no Rundown is upcoming, the Studio name will be displayed."}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"A screensaver showing the next scheduled show",src:t(63333).A+"",width:"1920",height:"1080"})}),"\n",(0,i.jsx)(n.h2,{id:"system-status",children:"System Status"}),"\n",(0,i.jsx)(n.admonition,{type:"caution",children:(0,i.jsx)(n.p,{children:"Documentation for this feature is yet to be written."})}),"\n",(0,i.jsx)(n.p,{children:"System and devices statuses are displayed here."}),"\n",(0,i.jsx)(n.admonition,{type:"info",children:(0,i.jsxs)(n.p,{children:["An API endpoint for the system status is also available under the URL ",(0,i.jsx)(n.code,{children:"/health"})]})}),"\n",(0,i.jsx)(n.h2,{id:"media-status-view",children:"Media Status View"}),"\n",(0,i.jsx)(n.admonition,{type:"caution",children:(0,i.jsx)(n.p,{children:"Documentation for this feature is yet to be written."})}),"\n",(0,i.jsx)(n.p,{children:"This page displays media transfer statuses."}),"\n",(0,i.jsx)(n.h2,{id:"message-queue-view",children:"Message Queue View"}),"\n",(0,i.jsx)(n.admonition,{type:"caution",children:(0,i.jsx)(n.p,{children:"Documentation for this feature is yet to be written."})}),"\n",(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.em,{children:"Sofie\xa0Core"})," can send messages to external systems (such as metadata, as-run-logs) while on air."]}),"\n",(0,i.jsx)(n.p,{children:"These messages are retained for a period of time, and can be reviewed in this list."}),"\n",(0,i.jsx)(n.p,{children:"Messages that was not successfully sent can be inspected and re-sent here."}),"\n",(0,i.jsx)(n.h2,{id:"user-log-view",children:"User Log View"}),"\n",(0,i.jsx)(n.p,{children:"The user activity log contains a list of the user-actions that users have previously done. This is used in troubleshooting issues on-air."}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"User Log",src:t(92717).A+"",width:"1126",height:"577"})}),"\n",(0,i.jsx)(n.h3,{id:"columns-explained",children:"Columns, explained"}),"\n",(0,i.jsx)(n.h4,{id:"execution-time",children:"Execution time"}),"\n",(0,i.jsxs)(n.p,{children:["The execution time column displays ",(0,i.jsx)(n.strong,{children:"coreDuration"})," + ",(0,i.jsx)(n.strong,{children:"gatewayDuration"})," (",(0,i.jsx)(n.strong,{children:"timelineResolveDuration"}),')":']}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"coreDuration"})," : The time it took for Core to execute the command (ie start-of-command \ud83e\udc3a stored-result-into-database)"]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"gatewayDuration"})," : The time it took for Playout Gateway to execute the timeline (ie stored-result-into-database \ud83e\udc3a timeline-resolved \ud83e\udc3a callback-to-core)"]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"timelineResolveDuration"}),": The duration it took in TSR (in Playout Gateway) to resolve the timeline"]}),"\n"]}),"\n",(0,i.jsxs)(n.p,{children:["Important to note is that ",(0,i.jsx)(n.strong,{children:"gatewayDuration"})," begins at the exact moment ",(0,i.jsx)(n.strong,{children:"coreDuration"})," ends.",(0,i.jsx)(n.br,{}),"\n","So ",(0,i.jsx)(n.strong,{children:"coreDuration + gatewayDuration"})," is the full time it took from beginning-of-user-action to the timeline-resolved (plus a little extra for the final callback for reporting the measurement)."]}),"\n",(0,i.jsx)(n.h4,{id:"action",children:"Action"}),"\n",(0,i.jsx)(n.p,{children:"Describes what action the user did; e g pressed a key, clicked a button, or selected a meny item."}),"\n",(0,i.jsx)(n.h4,{id:"method",children:"Method"}),"\n",(0,i.jsxs)(n.p,{children:["The internal name in ",(0,i.jsx)(n.em,{children:"Sofie\xa0Core"})," of what function was called"]}),"\n",(0,i.jsx)(n.h4,{id:"status",children:"Status"}),"\n",(0,i.jsx)(n.p,{children:'The result of the operation. "Success" or an error message.'}),"\n",(0,i.jsx)(n.h2,{id:"evaluations",children:"Evaluations"}),"\n",(0,i.jsx)(n.p,{children:"When a broadcast is done, users can input feedback about how the show went in an evaluation form."}),"\n",(0,i.jsx)(n.admonition,{type:"info",children:(0,i.jsxs)(n.p,{children:['Evaluations can be configured to be sent to Slack, by setting the "Slack Webhook URL" in the ',(0,i.jsx)(n.a,{href:"/sofie-core/docs/1.49.0/user-guide/configuration/settings-view",children:"Settings View"})," under ",(0,i.jsx)(n.em,{children:"Studio"}),"."]})}),"\n",(0,i.jsx)(n.h2,{id:"settings-view",children:"Settings View"}),"\n",(0,i.jsxs)(n.p,{children:["The ",(0,i.jsx)(n.a,{href:"/sofie-core/docs/1.49.0/user-guide/configuration/settings-view",children:"Settings View"})," is only available to users with the ",(0,i.jsx)(n.a,{href:"/sofie-core/docs/1.49.0/user-guide/features/access-levels",children:"Access Level"})," set correctly."]})]})}function p(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(u,{...e})}):u(e)}},22491:(e,n,t)=>{t.d(n,{A:()=>a});t(63696);var i=t(12689);const s={tabItem:"tabItem_wHwb"};var r=t(62540);function a(e){let{children:n,hidden:t,className:a}=e;return(0,r.jsx)("div",{role:"tabpanel",className:(0,i.A)(s.tabItem,a),hidden:t,children:n})}},78296:(e,n,t)=>{t.d(n,{A:()=>y});var i=t(63696),s=t(12689),r=t(90766),a=t(49519),o=t(14395),l=t(35043),d=t(44544),c=t(48708);function h(e){return i.Children.toArray(e).filter((e=>"\n"!==e)).map((e=>{if(!e||(0,i.isValidElement)(e)&&function(e){const{props:n}=e;return!!n&&"object"==typeof n&&"value"in n}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)}))?.filter(Boolean)??[]}function u(e){const{values:n,children:t}=e;return(0,i.useMemo)((()=>{const e=n??function(e){return h(e).map((e=>{let{props:{value:n,label:t,attributes:i,default:s}}=e;return{value:n,label:t,attributes:i,default:s}}))}(t);return function(e){const n=(0,d.X)(e,((e,n)=>e.value===n.value));if(n.length>0)throw new Error(`Docusaurus error: Duplicate values "${n.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[n,t])}function p(e){let{value:n,tabValues:t}=e;return t.some((e=>e.value===n))}function f(e){let{queryString:n=!1,groupId:t}=e;const s=(0,a.W6)(),r=function(e){let{queryString:n=!1,groupId:t}=e;if("string"==typeof n)return n;if(!1===n)return null;if(!0===n&&!t)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return t??null}({queryString:n,groupId:t});return[(0,l.aZ)(r),(0,i.useCallback)((e=>{if(!r)return;const n=new URLSearchParams(s.location.search);n.set(r,e),s.replace({...s.location,search:n.toString()})}),[r,s])]}function m(e){const{defaultValue:n,queryString:t=!1,groupId:s}=e,r=u(e),[a,l]=(0,i.useState)((()=>function(e){let{defaultValue:n,tabValues:t}=e;if(0===t.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(n){if(!p({value:n,tabValues:t}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${n}" but none of its children has the corresponding value. Available values are: ${t.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return n}const i=t.find((e=>e.default))??t[0];if(!i)throw new Error("Unexpected error: 0 tabValues");return i.value}({defaultValue:n,tabValues:r}))),[d,h]=f({queryString:t,groupId:s}),[m,w]=function(e){let{groupId:n}=e;const t=function(e){return e?`docusaurus.tab.${e}`:null}(n),[s,r]=(0,c.Dv)(t);return[s,(0,i.useCallback)((e=>{t&&r.set(e)}),[t,r])]}({groupId:s}),g=(()=>{const e=d??m;return p({value:e,tabValues:r})?e:null})();(0,o.A)((()=>{g&&l(g)}),[g]);return{selectedValue:a,selectValue:(0,i.useCallback)((e=>{if(!p({value:e,tabValues:r}))throw new Error(`Can't select invalid tab value=${e}`);l(e),h(e),w(e)}),[h,w,r]),tabValues:r}}var w=t(86681);const g={tabList:"tabList_J5MA",tabItem:"tabItem_l0OV"};var x=t(62540);function b(e){let{className:n,block:t,selectedValue:i,selectValue:a,tabValues:o}=e;const l=[],{blockElementScrollPositionUntilNextRender:d}=(0,r.a_)(),c=e=>{const n=e.currentTarget,t=l.indexOf(n),s=o[t].value;s!==i&&(d(n),a(s))},h=e=>{let n=null;switch(e.key){case"Enter":c(e);break;case"ArrowRight":{const t=l.indexOf(e.currentTarget)+1;n=l[t]??l[0];break}case"ArrowLeft":{const t=l.indexOf(e.currentTarget)-1;n=l[t]??l[l.length-1];break}}n?.focus()};return(0,x.jsx)("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,s.A)("tabs",{"tabs--block":t},n),children:o.map((e=>{let{value:n,label:t,attributes:r}=e;return(0,x.jsx)("li",{role:"tab",tabIndex:i===n?0:-1,"aria-selected":i===n,ref:e=>l.push(e),onKeyDown:h,onClick:c,...r,className:(0,s.A)("tabs__item",g.tabItem,r?.className,{"tabs__item--active":i===n}),children:t??n},n)}))})}function v(e){let{lazy:n,children:t,selectedValue:s}=e;const r=(Array.isArray(t)?t:[t]).filter(Boolean);if(n){const e=r.find((e=>e.props.value===s));return e?(0,i.cloneElement)(e,{className:"margin-top--md"}):null}return(0,x.jsx)("div",{className:"margin-top--md",children:r.map(((e,n)=>(0,i.cloneElement)(e,{key:n,hidden:e.props.value!==s})))})}function j(e){const n=m(e);return(0,x.jsxs)("div",{className:(0,s.A)("tabs-container",g.tabList),children:[(0,x.jsx)(b,{...e,...n}),(0,x.jsx)(v,{...e,...n})]})}function y(e){const n=(0,w.A)();return(0,x.jsx)(j,{...e,children:h(e.children)},String(n))}},46205:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/lobby-view-2afffa6612f09a5ec4ee02612a4fc7d4.png"},90670:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/active-rundown-example-d610ddc2a6afb7616c1b924dd9ed8874.png"},79829:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/active-rundown-shelf-example-4b59e9be5a9a69f8336b0984c2a6e9d1.png"},63333:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/next-scheduled-show-example-5577adc5c592cc24b4187a50f3d76ee7.png"},21553:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/presenter-screen-example-c03aacb8cb2603d40bca3c25e59b5657.png"},26534:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/presenter-screen-overlay-example-4cb0d6456ee71aa4fd097e38639ab018.png"},11475:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/prompter-example-eab23c526cc50324ed5e084f45fcfbe4.png"},95851:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/segment-header-2-c4865f2bc8d36c453b2e0c199b6f57cf.png"},92717:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/user-log-7c20897091807bd35a9f5a01ba8c4a86.png"},6162:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/freeze-frame-countdown-3e7017b0a4c21f394f4b4554fe83c4f3.png"},77789:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/list_view-05c2f46dc2dc260a49ce40722c62f617.png"},8422:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/rundown-divider-ab36ac6616fa8ef009fcabc73f8a76f4.png"},60908:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/segment-budget-and-countdown-212b500ac989e546f0855cfaee9cf783.png"},61881:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/shelf-8b4688dc6770c4e2564a0f54c7a61345.png"},31909:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/sofie-naming-conventions-fa68d78ba893a06bfc7ca17e5b967eb4.png"},2864:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/storyboard-d5d2ae7a2d3a12ddb867048c28895f83.png"},32049:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/switchboard-94799d19305991204e46d31f537962cc.png"},20256:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/take-next-8f7b8aa3baac95c6fe8abb450bc2dc4a.png"},43023:(e,n,t)=>{t.d(n,{R:()=>a,x:()=>o});var i=t(63696);const s={},r=i.createContext(s);function a(e){const n=i.useContext(r);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:a(e.components),i.createElement(r.Provider,{value:n},e.children)}}}]);