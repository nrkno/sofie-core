"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[7434],{15786:(e,o,n)=>{n.r(o),n.d(o,{assets:()=>d,contentTitle:()=>a,default:()=>c,frontMatter:()=>r,metadata:()=>s,toc:()=>l});var t=n(62540),i=n(43023);const r={},a="Lookahead",s={id:"for-developers/for-blueprint-developers/lookahead",title:"Lookahead",description:"Lookahead allows Sofie to look into future Parts and Pieces, in order to preload or preview what is coming up. The aim is to fill in the gaps between your TimelineObjects with lookahead versions of these objects.",source:"@site/versioned_docs/version-1.49.0/for-developers/for-blueprint-developers/lookahead.md",sourceDirName:"for-developers/for-blueprint-developers",slug:"/for-developers/for-blueprint-developers/lookahead",permalink:"/sofie-core/docs/1.49.0/for-developers/for-blueprint-developers/lookahead",draft:!1,unlisted:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.49.0/for-developers/for-blueprint-developers/lookahead.md",tags:[],version:"1.49.0",frontMatter:{},sidebar:"forDevelopers",previous:{title:"Hold",permalink:"/sofie-core/docs/1.49.0/for-developers/for-blueprint-developers/hold"},next:{title:"Part and Piece Timings",permalink:"/sofie-core/docs/1.49.0/for-developers/for-blueprint-developers/part-and-piece-timings"}},d={},l=[{value:"Defining",id:"defining",level:2},{value:"How it works",id:"how-it-works",level:2},{value:"Advanced Scenarios",id:"advanced-scenarios",level:2}];function h(e){const o={a:"a",br:"br",code:"code",h1:"h1",h2:"h2",li:"li",ol:"ol",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,i.R)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(o.h1,{id:"lookahead",children:"Lookahead"}),"\n",(0,t.jsxs)(o.p,{children:["Lookahead allows Sofie to look into future Parts and Pieces, in order to preload or preview what is coming up. The aim is to fill in the gaps between your TimelineObjects with lookahead versions of these objects.",(0,t.jsx)(o.br,{}),"\n","In this way, it can be used to provide functionality such as an AUX on your vision mixer showing the next cut, or to load the next clip into the media player."]}),"\n",(0,t.jsx)(o.h2,{id:"defining",children:"Defining"}),"\n",(0,t.jsx)(o.p,{children:"Lookahead can be enabled by configuring a few properties on a mapping:"}),"\n",(0,t.jsx)(o.pre,{children:(0,t.jsx)(o.code,{className:"language-ts",children:"/** What method core should use to create lookahead objects for this layer */\nlookahead: LookaheadMode\n/** The minimum number lookahead objects to create from future parts for this layer. Default = 1 */\nlookaheadDepth?: number\n/** Maximum distance to search for lookahead. Default = undefined */\nlookaheadMaxSearchDistance?: number\n"})}),"\n",(0,t.jsxs)(o.p,{children:["With ",(0,t.jsx)(o.code,{children:"LookaheadMode"})," defined as:"]}),"\n",(0,t.jsx)(o.pre,{children:(0,t.jsx)(o.code,{className:"language-ts",children:"export enum LookaheadMode {\n\t/**\n\t * Disable lookahead for this layer\n\t */\n\tNONE = 0,\n\t/**\n\t * Preload content with a secondary layer.\n\t * This requires support from the TSR device, to allow for preloading on a resource at the same time as it being on air.\n\t * For example, this allows for your TimelineObjects to control the foreground of a CasparCG layer, with lookahead controlling the background of the same layer.\n\t */\n\tPRELOAD = 1,\n\t/**\n\t * Fill the gaps between the planned objects on a layer.\n\t * This is the primary lookahead mode, and appears to TSR devices as a single layer of simple objects.\n\t */\n\tWHEN_CLEAR = 3,\n}\n"})}),"\n",(0,t.jsxs)(o.p,{children:["If undefined, ",(0,t.jsx)(o.code,{children:"lookaheadMaxSearchDistance"})," currently has a default distance of 10 parts. This number was chosen arbitrarily, and could change in the future. Be careful when choosing a distance to not set it too high. All the Pieces from the parts being searched have to be loaded from the database, which can come at a noticable cost."]}),"\n",(0,t.jsxs)(o.p,{children:["If you are doing ",(0,t.jsx)(o.a,{href:"/sofie-core/docs/1.49.0/for-developers/for-blueprint-developers/ab-playback",children:"AB Playback"}),", or performing some other processing of the timeline in ",(0,t.jsx)(o.code,{children:"onTimelineGenerate"}),", you may benefit from increasing the value of ",(0,t.jsx)(o.code,{children:"lookaheadDepth"}),". In the case of AB Playback, you will likely want to set it to the number of players available in your pool."]}),"\n",(0,t.jsxs)(o.p,{children:["Typically, TimelineObjects do not need anything special to support lookahead, other than a sensible ",(0,t.jsx)(o.code,{children:"priority"})," value. Lookahead objects are given a priority between ",(0,t.jsx)(o.code,{children:"0"})," and ",(0,t.jsx)(o.code,{children:"0.1"}),". Generally, your baseline objects should have a priority of ",(0,t.jsx)(o.code,{children:"0"})," so that they are overridden by lookahead, and any objects from your Parts and Pieces should have a priority of ",(0,t.jsx)(o.code,{children:"1"})," or higher, so that they override lookahead objects."]}),"\n",(0,t.jsxs)(o.p,{children:["If there are any keyframes on TimelineObjects that should be preserved when being converted to a lookahead object, they will need the ",(0,t.jsx)(o.code,{children:"preserveForLookahead"})," property set."]}),"\n",(0,t.jsx)(o.h2,{id:"how-it-works",children:"How it works"}),"\n",(0,t.jsx)(o.p,{children:"Lookahead is calculated while the timeline is being built, and searches based on the playhead, rather than looking at the planned Parts."}),"\n",(0,t.jsxs)(o.p,{children:["The searching operates per-layer first looking at the current PartInstance, then the next PartInstance and then any Parts after the next PartInstance in the rundown. Any Parts marked as ",(0,t.jsx)(o.code,{children:"invalid"})," or ",(0,t.jsx)(o.code,{children:"floated"})," are ignored. This is what allows lookahead to be dynamic based on what the User is doing and intending to play."]}),"\n",(0,t.jsxs)(o.p,{children:["It is searching Parts in that order, until it has either searched through the ",(0,t.jsx)(o.code,{children:"lookaheadMaxSearchDistance"})," number of Parts, or has found at least ",(0,t.jsx)(o.code,{children:"lookaheadDepth"})," future timeline objects."]}),"\n",(0,t.jsxs)(o.p,{children:["Any pieces marked as ",(0,t.jsx)(o.code,{children:"pieceType: IBlueprintPieceType.InTransition"})," will be considered only if playout intends to use the transition.",(0,t.jsx)(o.br,{}),"\n","If an object is found in both a normal piece with ",(0,t.jsx)(o.code,{children:"{ start: 0 }"})," and in an InTransition piece, then the objects from the normal piece will be ignored."]}),"\n",(0,t.jsx)(o.p,{children:"These objects are then processed and added to the timeline. This is done in one of two ways:"}),"\n",(0,t.jsxs)(o.ol,{children:["\n",(0,t.jsxs)(o.li,{children:["\n",(0,t.jsxs)(o.p,{children:["As timed objects.",(0,t.jsx)(o.br,{}),"\n","If the object selected for lookahead is already on the timeline (it is in the current part, or the next part and autonext is enabled), then timed lookahead objects are generated. These objects are to fill in the gaps, and get their ",(0,t.jsx)(o.code,{children:"enable"})," object to reference the objects on the timeline that they are filling between.\nThe ",(0,t.jsx)(o.code,{children:"lookaheadDepth"})," setting of the mapping is ignored for these objects."]}),"\n"]}),"\n",(0,t.jsxs)(o.li,{children:["\n",(0,t.jsxs)(o.p,{children:["As future objects.",(0,t.jsx)(o.br,{}),"\n","If the object selected for lookahead is not on the timeline, then simpler objects are generated. Instead, these get an enable of either ",(0,t.jsx)(o.code,{children:"{ while: '1' }"}),", or set to start after the last timed object on that layer. This lets them fill all the time after any other known objects.",(0,t.jsx)(o.br,{}),"\n","The ",(0,t.jsx)(o.code,{children:"lookaheadDepth"})," setting of the mapping is respected for these objects, with this number defining the ",(0,t.jsx)(o.strong,{children:"minimum"})," number future objects that will be produced. These future objects are inserted with a decreasing ",(0,t.jsx)(o.code,{children:"priority"}),", starting from 0.1 decreasing down to but never reaching 0.",(0,t.jsx)(o.br,{}),"\n","When using the ",(0,t.jsx)(o.code,{children:"WHEN_CLEAR"})," lookahead mode, all but the first will be set as ",(0,t.jsx)(o.code,{children:"disabled"}),", to ensure they aren't considered for being played out. These ",(0,t.jsx)(o.code,{children:"disabled"})," objects can be used by ",(0,t.jsx)(o.code,{children:"onTimelineGenerate"}),", or they will be dropped from the timeline if left ",(0,t.jsx)(o.code,{children:"disabled"}),".",(0,t.jsx)(o.br,{}),"\n","When there are multiple future objects on a layer, only the first is useful for playout directly, but the others are often utilised for ",(0,t.jsx)(o.a,{href:"/sofie-core/docs/1.49.0/for-developers/for-blueprint-developers/ab-playback",children:"AB Playback"})]}),"\n"]}),"\n"]}),"\n",(0,t.jsx)(o.p,{children:"Some additional changes done when processing each lookahead timeline object:"}),"\n",(0,t.jsxs)(o.ul,{children:["\n",(0,t.jsxs)(o.li,{children:["The ",(0,t.jsx)(o.code,{children:"id"})," is processed to be unique"]}),"\n",(0,t.jsxs)(o.li,{children:["The ",(0,t.jsx)(o.code,{children:"isLookahead"})," property is set as true"]}),"\n",(0,t.jsxs)(o.li,{children:["If the object has any keyframes, any not marked with ",(0,t.jsx)(o.code,{children:"preserveForLookahead"})," are removed"]}),"\n",(0,t.jsx)(o.li,{children:"The object is removed from any group it was contained within"}),"\n",(0,t.jsxs)(o.li,{children:["If the lookahead mode used is ",(0,t.jsx)(o.code,{children:"PRELOAD"}),", then the layer property is changed, with the ",(0,t.jsx)(o.code,{children:"lookaheadForLayer"})," property set to indicate the layer it is for."]}),"\n"]}),"\n",(0,t.jsxs)(o.p,{children:["The resulting objects are appended to the timeline and included in the call to ",(0,t.jsx)(o.code,{children:"onTimelineGenerate"})," and the ",(0,t.jsx)(o.a,{href:"/sofie-core/docs/1.49.0/for-developers/for-blueprint-developers/ab-playback",children:"AB Playback"})," resolving."]}),"\n",(0,t.jsx)(o.h2,{id:"advanced-scenarios",children:"Advanced Scenarios"}),"\n",(0,t.jsxs)(o.p,{children:["Because the lookahead objects are included in the timeline to ",(0,t.jsx)(o.code,{children:"onTimelineGenerate"}),", this gives you the ability to make changes to the lookahead output."]}),"\n",(0,t.jsxs)(o.p,{children:[(0,t.jsx)(o.a,{href:"/sofie-core/docs/1.49.0/for-developers/for-blueprint-developers/ab-playback",children:"AB Playback"})," started out as being implemented inside of ",(0,t.jsx)(o.code,{children:"onTimelineGenerate"})," and relies on lookahead objects being produced before reassigning them to other mappings."]}),"\n",(0,t.jsxs)(o.p,{children:["If any objects found by lookahead have a class ",(0,t.jsx)(o.code,{children:"_lookahead_start_delay"}),", they will be given a short delay in their start time. This is a hack introduced to workaround a timing issue. At some point this will be removed once a proper solution is found."]}),"\n",(0,t.jsxs)(o.p,{children:["Sometimes it can be useful to have keyframes which are only applied when in lookahead. That can be achieved by setting ",(0,t.jsx)(o.code,{children:"preserveForLookahead"}),", making the keyframe be disabled, and then re-enabling it inside ",(0,t.jsx)(o.code,{children:"onTimelineGenerate"})," at the correct time."]}),"\n",(0,t.jsx)(o.p,{children:"It is possible to implement a 'next' AUX on your vision mixer by:"}),"\n",(0,t.jsxs)(o.ul,{children:["\n",(0,t.jsxs)(o.li,{children:["Setup this mapping with ",(0,t.jsx)(o.code,{children:"lookaheadDepth: 1"})," and ",(0,t.jsx)(o.code,{children:"lookahead: LookaheadMode.WHEN_CLEAR"})]}),"\n",(0,t.jsx)(o.li,{children:"Each Part creates a TimelineObject on this mapping. Crucially, these have a priority of 0."}),"\n",(0,t.jsx)(o.li,{children:"Lookahead will run and will insert its objects overriding your predefined ones (because of its higher priority). Resulting in the AUX always showing the lookahead object."}),"\n"]})]})}function c(e={}){const{wrapper:o}={...(0,i.R)(),...e.components};return o?(0,t.jsx)(o,{...e,children:(0,t.jsx)(h,{...e})}):h(e)}},43023:(e,o,n)=>{n.d(o,{R:()=>a,x:()=>s});var t=n(63696);const i={},r=t.createContext(i);function a(e){const o=t.useContext(r);return t.useMemo((function(){return"function"==typeof e?e(o):{...o,...e}}),[o,e])}function s(e){let o;return o=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:a(e.components),t.createElement(r.Provider,{value:o},e.children)}}}]);