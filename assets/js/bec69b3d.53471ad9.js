"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[5847],{76230:(e,t,i)=>{i.r(t),i.d(t,{assets:()=>l,contentTitle:()=>r,default:()=>d,frontMatter:()=>a,metadata:()=>o,toc:()=>h});var n=i(62540),s=i(43023);const a={sidebar_position:1},r="Concepts & Architecture",o={id:"user-guide/concepts-and-architecture",title:"Concepts & Architecture",description:"System Architecture",source:"@site/versioned_docs/version-1.50.0/user-guide/concepts-and-architecture.md",sourceDirName:"user-guide",slug:"/user-guide/concepts-and-architecture",permalink:"/sofie-core/docs/1.50.0/user-guide/concepts-and-architecture",draft:!1,unlisted:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.50.0/user-guide/concepts-and-architecture.md",tags:[],version:"1.50.0",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"userGuide",previous:{title:"Introduction",permalink:"/sofie-core/docs/1.50.0/user-guide/intro"},next:{title:"Supported Playout Devices",permalink:"/sofie-core/docs/1.50.0/user-guide/supported-devices"}},l={},h=[{value:"System Architecture",id:"system-architecture",level:2},{value:"Sofie Core",id:"sofie-core",level:3},{value:"Gateways",id:"gateways",level:3},{value:"System, (Organization), Studio &amp; Show Style",id:"system-organization-studio--show-style",level:2},{value:"Playlists, Rundowns, Segments, Parts, Pieces",id:"playlists-rundowns-segments-parts-pieces",level:2},{value:"Playlist",id:"playlist",level:3},{value:"Rundown",id:"rundown",level:3},{value:"Segment",id:"segment",level:3},{value:"Part",id:"part",level:3},{value:"Piece",id:"piece",level:3},{value:"AdLib Piece",id:"adlib-piece",level:3},{value:"Buckets",id:"buckets",level:2},{value:"Views",id:"views",level:2},{value:"Blueprints",id:"blueprints",level:2},{value:"System Blueprints",id:"system-blueprints",level:3},{value:"Studio Blueprints",id:"studio-blueprints",level:3},{value:"Showstyle Blueprints",id:"showstyle-blueprints",level:3},{value:"<code>PartInstances</code> and <code>PieceInstances</code>",id:"partinstances-and-pieceinstances",level:2},{value:"Timeline",id:"timeline",level:2},{value:"What is the timeline?",id:"what-is-the-timeline",level:3},{value:"Why a timeline?",id:"why-a-timeline",level:3},{value:"How does it work?",id:"how-does-it-work",level:3}];function c(e){const t={a:"a",admonition:"admonition",br:"br",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",img:"img",li:"li",p:"p",strong:"strong",ul:"ul",...(0,s.R)(),...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(t.h1,{id:"concepts--architecture",children:"Concepts & Architecture"}),"\n",(0,n.jsx)(t.h2,{id:"system-architecture",children:"System Architecture"}),"\n",(0,n.jsx)(t.p,{children:(0,n.jsx)(t.img,{alt:"Example of a Sofie setup with a Playout Gateway and a Spreadsheet Gateway",src:i(35119).A+"",width:"827",height:"761"})}),"\n",(0,n.jsx)(t.h3,{id:"sofie-core",children:"Sofie Core"}),"\n",(0,n.jsxs)(t.p,{children:[(0,n.jsx)(t.strong,{children:"Sofie\xa0Core"})," is a web server which handle business logic and serves the web GUI.",(0,n.jsx)(t.br,{}),"\n","It is a ",(0,n.jsx)(t.a,{href:"https://nodejs.org/",children:"NodeJS"})," process backed up by a ",(0,n.jsx)(t.a,{href:"https://www.mongodb.com/",children:"MongoDB"})," database and based on the framework ",(0,n.jsx)(t.a,{href:"http://meteor.com/",children:"Meteor"}),"."]}),"\n",(0,n.jsx)(t.h3,{id:"gateways",children:"Gateways"}),"\n",(0,n.jsxs)(t.p,{children:["Gateways are applications that connect to Sofie\xa0Core and and exchanges data; such as rundown data from an NRCS or the ",(0,n.jsx)(t.a,{href:"#timeline",children:"Timeline"})," for playout."]}),"\n",(0,n.jsxs)(t.p,{children:["An examples of a gateways is the ",(0,n.jsx)(t.a,{href:"https://github.com/SuperFlyTV/spreadsheet-gateway",children:"Spreadsheet Gateway"}),".",(0,n.jsx)(t.br,{}),"\n","All gateways use the ",(0,n.jsx)(t.a,{href:"https://github.com/nrkno/sofie-core/tree/master/packages/server-core-integration",children:"Core Integration Library"})," to communicate with Core."]}),"\n",(0,n.jsx)(t.h2,{id:"system-organization-studio--show-style",children:"System, (Organization), Studio & Show Style"}),"\n",(0,n.jsx)(t.p,{children:'To be able to facilitate various workflows and to Here\'s a short explanation about the differences between the "System", "Organization", "Studio" and "Show Style".'}),"\n",(0,n.jsxs)(t.ul,{children:["\n",(0,n.jsxs)(t.li,{children:["The ",(0,n.jsx)(t.strong,{children:"System"})," defines the whole of the Sofie\xa0Core"]}),"\n",(0,n.jsxs)(t.li,{children:["The ",(0,n.jsx)(t.strong,{children:"Organization"})," (only available if user accounts are enabled) defines things that are common for an organization. An organization consists of: ",(0,n.jsx)(t.strong,{children:"Users, Studios"})," and ",(0,n.jsx)(t.strong,{children:"ShowStyles"}),"."]}),"\n",(0,n.jsxs)(t.li,{children:["The ",(0,n.jsx)(t.strong,{children:"Studio"}),' contains things that are related to the "hardware" or "rig". Technically, a Studio is defined as an entity that can have one (or none) rundown active at any given time. In most cases, this will be a representation of your gallery, with cameras, video playback and graphics systems, external inputs, sound mixers, lighting controls and so on. A single System can easily control multiple Studios.']}),"\n",(0,n.jsxs)(t.li,{children:["The ",(0,n.jsx)(t.strong,{children:"Show Style"}),' contains settings for the "show", for example if there\'s a "Morning Show" and an "Afternoon Show" - produced in the same gallery - they might be two different Show Styles (played in the same Studio). Most importantly, the Show Style decides the "look and feel" of the Show towards the producer/director, dictating how data ingested from the NRCS will be interpreted and how the user will interact with the system during playback (see: ',(0,n.jsx)(t.a,{href:"../configuration/settings-view#show-style",children:"Show Style"})," in Settings).","\n",(0,n.jsxs)(t.ul,{children:["\n",(0,n.jsxs)(t.li,{children:["A ",(0,n.jsx)(t.strong,{children:"Show Style Variant"})," is a set of Show Style ",(0,n.jsx)(t.em,{children:"Blueprint"})," configuration values, that allows to use the same interaction model across multiple Shows with potentially different assets, changing the outward look of the Show: for example news programs with different hosts produced from the same Studio, but with different light setups, backscreen and overlay graphics."]}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,n.jsx)(t.p,{children:(0,n.jsx)(t.img,{alt:"Sofie Architecture Venn Diagram",src:i(54613).A+"",width:"554",height:"559"})}),"\n",(0,n.jsx)(t.h2,{id:"playlists-rundowns-segments-parts-pieces",children:"Playlists, Rundowns, Segments, Parts, Pieces"}),"\n",(0,n.jsx)(t.p,{children:(0,n.jsx)(t.img,{alt:"Playlists, Rundowns, Segments, Parts, Pieces",src:i(81860).A+"",width:"2391",height:"1713"})}),"\n",(0,n.jsx)(t.h3,{id:"playlist",children:"Playlist"}),"\n",(0,n.jsx)(t.p,{children:'A Playlist (or "Rundown Playlist") is the entity that "goes on air" and controls the playhead/Take Point.'}),"\n",(0,n.jsx)(t.p,{children:"It contains one or several Rundowns inside, which are playout out in order."}),"\n",(0,n.jsx)(t.admonition,{type:"info",children:(0,n.jsx)(t.p,{children:'In some many studios, there is only ever one rundown in a playlist. In those cases, we sometimes lazily refer to playlists and rundowns as "being the same thing".'})}),"\n",(0,n.jsxs)(t.p,{children:["A Playlist is played out in the context of it's ",(0,n.jsx)(t.a,{href:"#studio",children:"Studio"}),", thereby only a single Playlist can be active at a time within each Studio."]}),"\n",(0,n.jsx)(t.p,{children:"A playlist is normally played through and then ends but it is also possible to make looping playlists in which case the playlist will start over from the top after the last part has been played."}),"\n",(0,n.jsx)(t.h3,{id:"rundown",children:"Rundown"}),"\n",(0,n.jsxs)(t.p,{children:["The Rundown contains the content for a show. It contains Segments and Parts, which can be selected by the user to be played out.",(0,n.jsx)(t.br,{}),"\n","A Rundown always has a ",(0,n.jsx)(t.a,{href:"#showstyle",children:"showstyle"})," and is played out in the context of the ",(0,n.jsx)(t.a,{href:"#studio",children:"Studio"})," of its Playlist."]}),"\n",(0,n.jsx)(t.h3,{id:"segment",children:"Segment"}),"\n",(0,n.jsxs)(t.p,{children:['The Segment is the horizontal line in the GUI. It is intended to be used as a "chapter" or "subject" in a rundown, where each individual playable element in the Segment is called a ',(0,n.jsx)(t.a,{href:"#part",children:"Part"}),"."]}),"\n",(0,n.jsx)(t.h3,{id:"part",children:"Part"}),"\n",(0,n.jsxs)(t.p,{children:["The Part is the playable element inside of a ",(0,n.jsx)(t.a,{href:"#segment",children:"Segment"}),". This is the thing that starts playing when the user does a ",(0,n.jsx)(t.a,{href:"#take-point",children:"TAKE"}),". A Playing part is ",(0,n.jsx)(t.em,{children:"On Air"})," or ",(0,n.jsx)(t.em,{children:"current"}),', while the part "cued" to be played is ',(0,n.jsx)(t.em,{children:"Next"}),".\nThe Part in itself doesn't determine what's going to happen, that's handled by the ",(0,n.jsx)(t.a,{href:"#piece",children:"Pieces"})," in it."]}),"\n",(0,n.jsx)(t.h3,{id:"piece",children:"Piece"}),"\n",(0,n.jsx)(t.p,{children:"The Pieces inside of a Part determines what's going to happen, the could be indicating things like VT's, cut to cameras, graphics, or what script the host is going to read."}),"\n",(0,n.jsxs)(t.p,{children:["Inside of the pieces are the ",(0,n.jsx)(t.a,{href:"#what-is-the-timeline",children:"timeline-objects"})," which controls the playout on a technical level."]}),"\n",(0,n.jsx)(t.admonition,{type:"tip",children:(0,n.jsxs)(t.p,{children:["Tip! If you want to manually play a certain piece (for example a graphics overlay), you can at any time double-click it in the GUI, and it will be copied and played at your play head, just like an ",(0,n.jsx)(t.a,{href:"#adlib-pieces",children:"AdLib"})," would!"]})}),"\n",(0,n.jsxs)(t.p,{children:["See also: ",(0,n.jsx)(t.a,{href:"#system-organization-studio--show-style",children:"Showstyle"})]}),"\n",(0,n.jsx)(t.h3,{id:"adlib-piece",children:"AdLib Piece"}),"\n",(0,n.jsx)(t.p,{children:"The AdLib pieces are Pieces that isn't programmed to fire at a specific time, but instead intended to be manually triggered by the user."}),"\n",(0,n.jsxs)(t.p,{children:["The AdLib pieces can either come from the currently playing Part, or it could be ",(0,n.jsx)(t.em,{children:"global AdLibs"})," that are available throughout the show."]}),"\n",(0,n.jsxs)(t.p,{children:["An AdLib isn't added to the Part in the GUI until it starts playing, instead you find it in the ",(0,n.jsx)(t.a,{href:"/sofie-core/docs/1.50.0/user-guide/features/sofie-views#shelf",children:"Shelf"}),"."]}),"\n",(0,n.jsx)(t.h2,{id:"buckets",children:"Buckets"}),"\n",(0,n.jsx)(t.p,{children:"A Bucket is a container for AdLib Pieces created by the producer/operator during production. They exist independently of the Rundowns and associated content created by ingesting data from the NRCS. Users can freely create, modify and remove Buckets."}),"\n",(0,n.jsxs)(t.p,{children:["The primary use-case of these elements is for breaking news formats where quick turnaround video editing may require circumvention of the regular flow of show assets and programming via the NRCS. Currently, one way of creating AdLibs inside Buckets is using a MOS Plugin integration inside the Shelf, where MOS ",(0,n.jsx)(t.a,{href:"https://mosprotocol.com/wp-content/MOS-Protocol-Documents/MOS-Protocol-2.8.4-Current.htm#ncsItem",children:"ncsItem"})," elements can be dragged from the MOS Plugin onto a bucket and ingested."]}),"\n",(0,n.jsxs)(t.p,{children:["The ingest happens via the ",(0,n.jsx)(t.code,{children:"getAdlibItem"})," method: ",(0,n.jsx)(t.a,{href:"https://github.com/nrkno/sofie-core/blob/master/packages/blueprints-integration/src/api.ts#L215",children:"https://github.com/nrkno/sofie-core/blob/master/packages/blueprints-integration/src/api.ts#L215"})]}),"\n",(0,n.jsx)(t.h2,{id:"views",children:"Views"}),"\n",(0,n.jsxs)(t.p,{children:["Being a web-based system, Sofie has a number of customisable, user-facing web ",(0,n.jsx)(t.a,{href:"/sofie-core/docs/1.50.0/user-guide/features/sofie-views",children:"views"})," used for control and monitoring."]}),"\n",(0,n.jsx)(t.h2,{id:"blueprints",children:"Blueprints"}),"\n",(0,n.jsx)(t.p,{children:"Blueprints are plug-ins that run in Sofie\xa0Core. They interpret the data coming in from the rundowns and transform them into a rich set of playable elements (Segments, Parts, AdLibs etc)."}),"\n",(0,n.jsxs)(t.p,{children:["The blueprints are webpacked javascript bundles which are uploaded into Sofie via the GUI. They are custom-made and changes depending on the show style, type of input data (NRCS) and the types of controlled devices. A generic ",(0,n.jsx)(t.a,{href:"https://github.com/SuperFlyTV/sofie-demo-blueprints",children:"blueprint that works with spreadsheets is available here"}),"."]}),"\n",(0,n.jsxs)(t.p,{children:["When ",(0,n.jsx)(t.a,{href:"#sofie-core",children:"Sofie\xa0Core"})," calls upon a Blueprint, it returns a JavaScript object containing methods callable by Sofie\xa0Core. These methods will be called by Sofie\xa0Core in different situations, depending on the method.",(0,n.jsx)(t.br,{}),"\n","Documentation on these interfaces are available in the ",(0,n.jsx)(t.a,{href:"https://www.npmjs.com/package/@sofie-automation/blueprints-integration",children:"Blueprints integration"})," library."]}),"\n",(0,n.jsx)(t.p,{children:"There are 3 types of blueprints, and all 3 must be uploaded into Sofie before the system will work correctly."}),"\n",(0,n.jsx)(t.h3,{id:"system-blueprints",children:"System Blueprints"}),"\n",(0,n.jsxs)(t.p,{children:["Handle things on the ",(0,n.jsx)(t.em,{children:"System level"}),".",(0,n.jsx)(t.br,{}),"\n","Documentation on the interface to be exposed by the Blueprint:",(0,n.jsx)(t.br,{}),"\n",(0,n.jsx)(t.a,{href:"https://github.com/nrkno/sofie-core/blob/master/packages/blueprints-integration/src/api.ts#L75",children:"https://github.com/nrkno/sofie-core/blob/master/packages/blueprints-integration/src/api.ts#L75"})]}),"\n",(0,n.jsx)(t.h3,{id:"studio-blueprints",children:"Studio Blueprints"}),"\n",(0,n.jsxs)(t.p,{children:["Handle things on the ",(0,n.jsx)(t.em,{children:"Studio level"}),', like "which showstyle to use for this rundown".',(0,n.jsx)(t.br,{}),"\n","Documentation on the interface to be exposed by the Blueprint:",(0,n.jsx)(t.br,{}),"\n",(0,n.jsx)(t.a,{href:"https://github.com/nrkno/sofie-core/blob/master/packages/blueprints-integration/src/api.ts#L85",children:"https://github.com/nrkno/sofie-core/blob/master/packages/blueprints-integration/src/api.ts#L85"})]}),"\n",(0,n.jsx)(t.h3,{id:"showstyle-blueprints",children:"Showstyle Blueprints"}),"\n",(0,n.jsxs)(t.p,{children:["Handle things on the ",(0,n.jsx)(t.em,{children:"Showstyle level"}),", like generating ",(0,n.jsx)(t.a,{href:"#baseline",children:(0,n.jsx)(t.em,{children:"Baseline"})}),", ",(0,n.jsx)(t.em,{children:"Segments"}),", ",(0,n.jsx)(t.em,{children:"Parts, Pieces"})," and ",(0,n.jsx)(t.em,{children:"Timelines"})," in a rundown.",(0,n.jsx)(t.br,{}),"\n","Documentation on the interface to be exposed by the Blueprint:",(0,n.jsx)(t.br,{}),"\n",(0,n.jsx)(t.a,{href:"https://github.com/nrkno/sofie-core/blob/master/packages/blueprints-integration/src/api.ts#L117",children:"https://github.com/nrkno/sofie-core/blob/master/packages/blueprints-integration/src/api.ts#L117"})]}),"\n",(0,n.jsxs)(t.h2,{id:"partinstances-and-pieceinstances",children:[(0,n.jsx)(t.code,{children:"PartInstances"})," and ",(0,n.jsx)(t.code,{children:"PieceInstances"})]}),"\n",(0,n.jsxs)(t.p,{children:["In order to be able to facilitate ingesting changes from the NRCS while continuing to provide a stable and predictable playback of the Rundowns, Sofie internally uses a concept of ",(0,n.jsx)(t.a,{href:"https://en.wikipedia.org/wiki/Instance_(computer_science)",children:'"instantiation"'})," of key Rundown elements. Before playback of a Part can begin, the Part and it's Pieces are copied into an Instance of a Part: a ",(0,n.jsx)(t.code,{children:"PartInstance"}),". This protects the contents of the ",(0,n.jsx)(t.em,{children:"Next"})," and ",(0,n.jsx)(t.em,{children:"On Air"}),' part, preventing accidental changes that could surprise the producer/director. This also makes it possible to inspect the "as played" state of the Rundown, independently of the "as planned" state ingested from the NRCS.']}),"\n",(0,n.jsxs)(t.p,{children:["The blueprints can optionally allow some changes to the Parts and Pieces to be forwarded onto these ",(0,n.jsx)(t.code,{children:"PartInstances"}),": ",(0,n.jsx)(t.a,{href:"https://github.com/nrkno/sofie-core/blob/master/packages/blueprints-integration/src/api.ts#L190",children:"https://github.com/nrkno/sofie-core/blob/master/packages/blueprints-integration/src/api.ts#L190"})]}),"\n",(0,n.jsx)(t.h2,{id:"timeline",children:"Timeline"}),"\n",(0,n.jsx)(t.h3,{id:"what-is-the-timeline",children:"What is the timeline?"}),"\n",(0,n.jsx)(t.p,{children:'The Timeline is a collection of timeline-objects, that together form a "target state", i.e. an intent on what is to be played and at what times.'}),"\n",(0,n.jsxs)(t.p,{children:["The timeline-objects can be programmed to contain relative references to each other, so programming things like ",(0,n.jsx)(t.em,{children:'"play this thing right after this other thing"'})," is as easy as ",(0,n.jsx)(t.code,{children:"{start: { #otherThing.end }}"})]}),"\n",(0,n.jsxs)(t.p,{children:["The ",(0,n.jsx)(t.a,{href:"/sofie-core/docs/1.50.0/for-developers/libraries",children:"Playout Gateway"})," picks up the timeline from Sofie\xa0Core and (using the ",(0,n.jsx)(t.a,{href:"https://github.com/nrkno/sofie-timeline-state-resolver",children:"TSR timeline-state-resolver"}),") controls the playout devices to make sure that they actually play what is intended."]}),"\n",(0,n.jsx)(t.p,{children:(0,n.jsx)(t.img,{alt:"Example of 2 objects in a timeline: The #video object, destined to play at a certain time, and #gfx0, destined to start 15 seconds into the video.",src:i(71456).A+"",width:"1039",height:"259"})}),"\n",(0,n.jsx)(t.h3,{id:"why-a-timeline",children:"Why a timeline?"}),"\n",(0,n.jsx)(t.p,{children:"The Sofie system is made to work with a modern web- and IT-based approach in mind. Therefore, the Sofie\xa0Core can be run either on-site, or in an off-site cloud."}),"\n",(0,n.jsx)(t.p,{children:(0,n.jsx)(t.img,{alt:"Sofie\xa0Core can run in the cloud",src:i(42512).A+"",width:"686",height:"209"})}),"\n",(0,n.jsxs)(t.p,{children:["One drawback of running in a cloud over the public internet is the - sometimes unpredictable - latency. The Timeline overcomes this by moving all the immediate control of the playout devices to the Playout Gateway, which is intended to run on a local network, close to the hardware it controls.",(0,n.jsx)(t.br,{}),"\n","This also gives the system a simple way of load-balancing - since the number of web-clients or load on Sofie\xa0Core won't affect the playout."]}),"\n",(0,n.jsx)(t.p,{children:'Another benefit of basing the playout on a timeline is that when programming the show (the blueprints), you only have to care about "what you want to be on screen", you don\'t have to care about cleaning up previously played things, or what was actually played out before. Those are things that are handled by the Playout Gateway automatically. This also allows the user to jump around in a rundown freely, without the risk of things going wrong on air.'}),"\n",(0,n.jsx)(t.h3,{id:"how-does-it-work",children:"How does it work?"}),"\n",(0,n.jsxs)(t.admonition,{type:"tip",children:[(0,n.jsxs)(t.p,{children:["Fun tip! The timeline in itself is a ",(0,n.jsx)(t.a,{href:"https://github.com/SuperFlyTV/supertimeline",children:"separate library available on github"}),"."]}),(0,n.jsxs)(t.p,{children:["You can play around with the timeline in the browser using ",(0,n.jsx)(t.a,{href:"https://jsfiddle.net/nytamin/rztp517u/",children:"JSFiddle and the timeline-visualizer"}),"!"]})]}),"\n",(0,n.jsxs)(t.p,{children:["The Timeline is stored by Sofie\xa0Core in a MongoDB collection. It is generated whenever a user does a ",(0,n.jsx)(t.a,{href:"#take-point",children:"Take"}),", changes the ",(0,n.jsx)(t.a,{href:"#next-point-and-lookahead",children:"Next-point"})," or anything else that might affect the playout."]}),"\n",(0,n.jsxs)(t.p,{children:[(0,n.jsx)(t.em,{children:"Sofie\xa0Core"})," generates the timeline using:"]}),"\n",(0,n.jsxs)(t.ul,{children:["\n",(0,n.jsxs)(t.li,{children:["The ",(0,n.jsx)(t.a,{href:"#baseline",children:"Studio Baseline"})," (only if no rundown is currently active)"]}),"\n",(0,n.jsxs)(t.li,{children:["The ",(0,n.jsx)(t.a,{href:"#baseline",children:"Showstyle Baseline"}),", of the currently active rundown."]}),"\n",(0,n.jsxs)(t.li,{children:["The ",(0,n.jsx)(t.a,{href:"#take-point",children:"currently playing Part"})]}),"\n",(0,n.jsxs)(t.li,{children:["The ",(0,n.jsx)(t.a,{href:"#next-point-and-lookahead",children:"Next'ed Part"})," and Parts that come after it (the ",(0,n.jsx)(t.a,{href:"#lookahead",children:"Lookahead"}),")"]}),"\n",(0,n.jsxs)(t.li,{children:["Any ",(0,n.jsx)(t.a,{href:"#adlib-pieces",children:"AdLibs"})," the user has manually selected to play"]}),"\n"]}),"\n",(0,n.jsxs)(t.p,{children:["The ",(0,n.jsx)(t.a,{href:"/sofie-core/docs/1.50.0/for-developers/libraries#gateways",children:(0,n.jsx)(t.strong,{children:"Playout Gateway"})})," then picks up the new timeline, and pipes it into the ",(0,n.jsx)(t.a,{href:"https://github.com/nrkno/sofie-timeline-state-resolver",children:"(TSR) timeline-state-resolver"})," library."]}),"\n",(0,n.jsx)(t.p,{children:"The TSR then..."}),"\n",(0,n.jsxs)(t.ul,{children:["\n",(0,n.jsxs)(t.li,{children:["Resolves the timeline, using the ",(0,n.jsx)(t.a,{href:"https://github.com/SuperFlyTV/supertimeline",children:"timeline-library"})]}),"\n",(0,n.jsx)(t.li,{children:"Calculates new target-states for each relevant point in time"}),"\n",(0,n.jsx)(t.li,{children:"Maps the target-state to each playout device"}),"\n",(0,n.jsx)(t.li,{children:"Compares the target-states for each device with the currently-tracked-state and.."}),"\n",(0,n.jsx)(t.li,{children:"Generates commands to send to each device to account for the change"}),"\n",(0,n.jsx)(t.li,{children:"The commands are then put on queue and sent to the devices at the correct time"}),"\n"]}),"\n",(0,n.jsx)(t.admonition,{type:"info",children:(0,n.jsxs)(t.p,{children:["For more information about what playout devices ",(0,n.jsx)(t.em,{children:"TSR"})," supports, and examples of the timeline-objects, see the ",(0,n.jsx)(t.a,{href:"https://github.com/nrkno/sofie-timeline-state-resolver#timeline-state-resolver",children:"README of TSR"})]})}),"\n",(0,n.jsx)(t.admonition,{type:"info",children:(0,n.jsxs)(t.p,{children:["For more information about how to program timeline-objects, see the ",(0,n.jsx)(t.a,{href:"https://github.com/SuperFlyTV/supertimeline#superfly-timeline",children:"README of the timeline-library"})]})})]})}function d(e={}){const{wrapper:t}={...(0,s.R)(),...e.components};return t?(0,n.jsx)(t,{...e,children:(0,n.jsx)(c,{...e})}):c(e)}},81860:(e,t,i)=>{i.d(t,{A:()=>n});const n=i.p+"assets/images/playlist-rundown-segment-part-piece-7bbb83383039ace050bf391947d91725.png"},35119:(e,t,i)=>{i.d(t,{A:()=>n});const n=i.p+"assets/images/playout-and-spreadsheet-example-b12546e2be214cfc445edd06b67e9633.png"},54613:(e,t,i)=>{i.d(t,{A:()=>n});const n=i.p+"assets/images/sofie-venn-diagram-f65669f7bddbd15ccd14d007227ab776.png"},42512:(e,t,i)=>{i.d(t,{A:()=>n});const n=i.p+"assets/images/sofie-web-architecture-812d04b46362f24b9f1965b7a92078e1.png"},71456:(e,t,i)=>{i.d(t,{A:()=>n});const n=i.p+"assets/images/timeline-d1a95c05adc953f15adae8a0e3aaaf48.png"},43023:(e,t,i)=>{i.d(t,{R:()=>r,x:()=>o});var n=i(63696);const s={},a=n.createContext(s);function r(e){const t=n.useContext(a);return n.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function o(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:r(e.components),n.createElement(a.Provider,{value:t},e.children)}}}]);