"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[404],{5318:(e,t,a)=>{a.d(t,{Zo:()=>p,kt:()=>m});var n=a(7378);function o(e,t,a){return t in e?Object.defineProperty(e,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[t]=a,e}function r(e,t){var a=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),a.push.apply(a,n)}return a}function i(e){for(var t=1;t<arguments.length;t++){var a=null!=arguments[t]?arguments[t]:{};t%2?r(Object(a),!0).forEach((function(t){o(e,t,a[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(a)):r(Object(a)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(a,t))}))}return e}function l(e,t){if(null==e)return{};var a,n,o=function(e,t){if(null==e)return{};var a,n,o={},r=Object.keys(e);for(n=0;n<r.length;n++)a=r[n],t.indexOf(a)>=0||(o[a]=e[a]);return o}(e,t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);for(n=0;n<r.length;n++)a=r[n],t.indexOf(a)>=0||Object.prototype.propertyIsEnumerable.call(e,a)&&(o[a]=e[a])}return o}var s=n.createContext({}),d=function(e){var t=n.useContext(s),a=t;return e&&(a="function"==typeof e?e(t):i(i({},t),e)),a},p=function(e){var t=d(e.components);return n.createElement(s.Provider,{value:t},e.children)},h="mdxType",c={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},u=n.forwardRef((function(e,t){var a=e.components,o=e.mdxType,r=e.originalType,s=e.parentName,p=l(e,["components","mdxType","originalType","parentName"]),h=d(a),u=o,m=h["".concat(s,".").concat(u)]||h[u]||c[u]||r;return a?n.createElement(m,i(i({ref:t},p),{},{components:a})):n.createElement(m,i({ref:t},p))}));function m(e,t){var a=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var r=a.length,i=new Array(r);i[0]=u;var l={};for(var s in t)hasOwnProperty.call(t,s)&&(l[s]=t[s]);l.originalType=e,l[h]="string"==typeof e?e:o,i[1]=l;for(var d=2;d<r;d++)i[d]=a[d];return n.createElement.apply(null,i)}return n.createElement.apply(null,a)}u.displayName="MDXCreateElement"},6634:(e,t,a)=>{a.r(t),a.d(t,{assets:()=>s,contentTitle:()=>i,default:()=>c,frontMatter:()=>r,metadata:()=>l,toc:()=>d});var n=a(5773),o=(a(7378),a(5318));const r={},i="Lookahead",l={unversionedId:"for-developers/for-blueprint-developers/lookahead",id:"version-1.47.0/for-developers/for-blueprint-developers/lookahead",title:"Lookahead",description:"Lookahead allows Sofie to look into future Parts and Pieces, in order to preload or preview what is coming up. The aim is to fill in the gaps between your TimelineObjects with lookahead versions of these objects.",source:"@site/versioned_docs/version-1.47.0/for-developers/for-blueprint-developers/lookahead.md",sourceDirName:"for-developers/for-blueprint-developers",slug:"/for-developers/for-blueprint-developers/lookahead",permalink:"/sofie-core/docs/1.47.0/for-developers/for-blueprint-developers/lookahead",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.47.0/for-developers/for-blueprint-developers/lookahead.md",tags:[],version:"1.47.0",frontMatter:{},sidebar:"version-1.47.0/forDevelopers",previous:{title:"Hold",permalink:"/sofie-core/docs/1.47.0/for-developers/for-blueprint-developers/hold"},next:{title:"Part and Piece Timings",permalink:"/sofie-core/docs/1.47.0/for-developers/for-blueprint-developers/part-and-piece-timings"}},s={},d=[{value:"Defining",id:"defining",level:2},{value:"How it works",id:"how-it-works",level:2},{value:"Advanced Scenarios",id:"advanced-scenarios",level:2}],p={toc:d},h="wrapper";function c(e){let{components:t,...a}=e;return(0,o.kt)(h,(0,n.Z)({},p,a,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"lookahead"},"Lookahead"),(0,o.kt)("p",null,"Lookahead allows Sofie to look into future Parts and Pieces, in order to preload or preview what is coming up. The aim is to fill in the gaps between your TimelineObjects with lookahead versions of these objects.",(0,o.kt)("br",{parentName:"p"}),"\n","In this way, it can be used to provide functionality such as an AUX on your vision mixer showing the next cut, or to load the next clip into the media player."),(0,o.kt)("h2",{id:"defining"},"Defining"),(0,o.kt)("p",null,"Lookahead can be enabled by configuring a few properties on a mapping:"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-ts"},"/** What method core should use to create lookahead objects for this layer */\nlookahead: LookaheadMode\n/** The minimum number lookahead objects to create from future parts for this layer. Default = 1 */\nlookaheadDepth?: number\n/** Maximum distance to search for lookahead. Default = undefined */\nlookaheadMaxSearchDistance?: number\n")),(0,o.kt)("p",null,"With ",(0,o.kt)("inlineCode",{parentName:"p"},"LookaheadMode")," defined as:"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-ts"},"export enum LookaheadMode {\n    /**\n     * Disable lookahead for this layer\n     */\n    NONE = 0,\n    /**\n     * Preload content with a secondary layer.\n     * This requires support from the TSR device, to allow for preloading on a resource at the same time as it being on air.\n     * For example, this allows for your TimelineObjects to control the foreground of a CasparCG layer, with lookahead controlling the background of the same layer.\n     */\n    PRELOAD = 1,\n    /**\n     * Fill the gaps between the planned objects on a layer.\n     * This is the primary lookahead mode, and appears to TSR devices as a single layer of simple objects.\n     */\n    WHEN_CLEAR = 3,\n}\n")),(0,o.kt)("p",null,"If undefined, ",(0,o.kt)("inlineCode",{parentName:"p"},"lookaheadMaxSearchDistance")," currently has a default distance of 10 parts. This number was chosen arbitrarily, and could change in the future. Be careful when choosing a distance to not set it too high. All the Pieces from the parts being searched have to be loaded from the database, which can come at a noticable cost."),(0,o.kt)("p",null,"If you are doing ",(0,o.kt)("a",{parentName:"p",href:"/sofie-core/docs/1.47.0/for-developers/for-blueprint-developers/ab-playback"},"AB Playback"),", or performing some other processing of the timeline in ",(0,o.kt)("inlineCode",{parentName:"p"},"onTimelineGenerate"),", you may benefit from increasing the value of ",(0,o.kt)("inlineCode",{parentName:"p"},"lookaheadDepth"),". In the case of AB Playback, you will likely want to set it to the number of players available in your pool."),(0,o.kt)("p",null,"Typically, TimelineObjects do not need anything special to support lookahead, other than a sensible ",(0,o.kt)("inlineCode",{parentName:"p"},"priority")," value. Lookahead objects are given a priority between ",(0,o.kt)("inlineCode",{parentName:"p"},"0")," and ",(0,o.kt)("inlineCode",{parentName:"p"},"0.1"),". Generally, your baseline objects should have a priority of ",(0,o.kt)("inlineCode",{parentName:"p"},"0")," so that they are overridden by lookahead, and any objects from your Parts and Pieces should have a priority of ",(0,o.kt)("inlineCode",{parentName:"p"},"1")," or higher, so that they override lookahead objects."),(0,o.kt)("p",null,"If there are any keyframes on TimelineObjects that should be preserved when being converted to a lookahead object, they will need the ",(0,o.kt)("inlineCode",{parentName:"p"},"preserveForLookahead")," property set."),(0,o.kt)("h2",{id:"how-it-works"},"How it works"),(0,o.kt)("p",null,"Lookahead is calculated while the timeline is being built, and searches based on the playhead, rather than looking at the planned Parts."),(0,o.kt)("p",null,"The searching operates per-layer first looking at the current PartInstance, then the next PartInstance and then any Parts after the next PartInstance in the rundown. Any Parts marked as ",(0,o.kt)("inlineCode",{parentName:"p"},"invalid")," or ",(0,o.kt)("inlineCode",{parentName:"p"},"floated")," are ignored. This is what allows lookahead to be dynamic based on what the User is doing and intending to play."),(0,o.kt)("p",null,"It is searching Parts in that order, until it has either searched through the ",(0,o.kt)("inlineCode",{parentName:"p"},"lookaheadMaxSearchDistance")," number of Parts, or has found at least ",(0,o.kt)("inlineCode",{parentName:"p"},"lookaheadDepth")," future timeline objects."),(0,o.kt)("p",null,"Any pieces marked as ",(0,o.kt)("inlineCode",{parentName:"p"},"pieceType: IBlueprintPieceType.InTransition")," will be considered only if playout intends to use the transition.",(0,o.kt)("br",{parentName:"p"}),"\n","If an object is found in both a normal piece with ",(0,o.kt)("inlineCode",{parentName:"p"},"{ start: 0 }")," and in an InTransition piece, then the objects from the normal piece will be ignored."),(0,o.kt)("p",null,"These objects are then processed and added to the timeline. This is done in one of two ways:"),(0,o.kt)("ol",null,(0,o.kt)("li",{parentName:"ol"},(0,o.kt)("p",{parentName:"li"},"As timed objects.",(0,o.kt)("br",{parentName:"p"}),"\n","If the object selected for lookahead is already on the timeline (it is in the current part, or the next part and autonext is enabled), then timed lookahead objects are generated. These objects are to fill in the gaps, and get their ",(0,o.kt)("inlineCode",{parentName:"p"},"enable")," object to reference the objects on the timeline that they are filling between.\nThe ",(0,o.kt)("inlineCode",{parentName:"p"},"lookaheadDepth")," setting of the mapping is ignored for these objects.")),(0,o.kt)("li",{parentName:"ol"},(0,o.kt)("p",{parentName:"li"},"As future objects.",(0,o.kt)("br",{parentName:"p"}),"\n","If the object selected for lookahead is not on the timeline, then simpler objects are generated. Instead, these get an enable of either ",(0,o.kt)("inlineCode",{parentName:"p"},"{ while: '1' }"),", or set to start after the last timed object on that layer. This lets them fill all the time after any other known objects.",(0,o.kt)("br",{parentName:"p"}),"\n","The ",(0,o.kt)("inlineCode",{parentName:"p"},"lookaheadDepth")," setting of the mapping is respected for these objects, with this number defining the ",(0,o.kt)("strong",{parentName:"p"},"minimum")," number future objects that will be produced. These future objects are inserted with a decreasing ",(0,o.kt)("inlineCode",{parentName:"p"},"priority"),", starting from 0.1 decreasing down to but never reaching 0.",(0,o.kt)("br",{parentName:"p"}),"\n","When using the ",(0,o.kt)("inlineCode",{parentName:"p"},"WHEN_CLEAR")," lookahead mode, all but the first will be set as ",(0,o.kt)("inlineCode",{parentName:"p"},"disabled"),", to ensure they aren't considered for being played out. These ",(0,o.kt)("inlineCode",{parentName:"p"},"disabled")," objects can be used by ",(0,o.kt)("inlineCode",{parentName:"p"},"onTimelineGenerate"),", or they will be dropped from the timeline if left ",(0,o.kt)("inlineCode",{parentName:"p"},"disabled"),".",(0,o.kt)("br",{parentName:"p"}),"\n","When there are multiple future objects on a layer, only the first is useful for playout directly, but the others are often utilised for ",(0,o.kt)("a",{parentName:"p",href:"/sofie-core/docs/1.47.0/for-developers/for-blueprint-developers/ab-playback"},"AB Playback")))),(0,o.kt)("p",null,"Some additional changes done when processing each lookahead timeline object:"),(0,o.kt)("ul",null,(0,o.kt)("li",{parentName:"ul"},"The ",(0,o.kt)("inlineCode",{parentName:"li"},"id")," is processed to be unique"),(0,o.kt)("li",{parentName:"ul"},"The ",(0,o.kt)("inlineCode",{parentName:"li"},"isLookahead")," property is set as true"),(0,o.kt)("li",{parentName:"ul"},"If the object has any keyframes, any not marked with ",(0,o.kt)("inlineCode",{parentName:"li"},"preserveForLookahead")," are removed"),(0,o.kt)("li",{parentName:"ul"},"The object is removed from any group it was contained within"),(0,o.kt)("li",{parentName:"ul"},"If the lookahead mode used is ",(0,o.kt)("inlineCode",{parentName:"li"},"PRELOAD"),", then the layer property is changed, with the ",(0,o.kt)("inlineCode",{parentName:"li"},"lookaheadForLayer")," property set to indicate the layer it is for.")),(0,o.kt)("p",null,"The resulting objects are appended to the timeline and included in the call to ",(0,o.kt)("inlineCode",{parentName:"p"},"onTimelineGenerate")," and the ",(0,o.kt)("a",{parentName:"p",href:"/sofie-core/docs/1.47.0/for-developers/for-blueprint-developers/ab-playback"},"AB Playback")," resolving."),(0,o.kt)("h2",{id:"advanced-scenarios"},"Advanced Scenarios"),(0,o.kt)("p",null,"Because the lookahead objects are included in the timeline to ",(0,o.kt)("inlineCode",{parentName:"p"},"onTimelineGenerate"),", this gives you the ability to make changes to the lookahead output."),(0,o.kt)("p",null,(0,o.kt)("a",{parentName:"p",href:"/sofie-core/docs/1.47.0/for-developers/for-blueprint-developers/ab-playback"},"AB Playback")," started out as being implemented inside of ",(0,o.kt)("inlineCode",{parentName:"p"},"onTimelineGenerate")," and relies on lookahead objects being produced before reassigning them to other mappings."),(0,o.kt)("p",null,"If any objects found by lookahead have a class ",(0,o.kt)("inlineCode",{parentName:"p"},"_lookahead_start_delay"),", they will be given a short delay in their start time. This is a hack introduced to workaround a timing issue. At some point this will be removed once a proper solution is found."),(0,o.kt)("p",null,"Sometimes it can be useful to have keyframes which are only applied when in lookahead. That can be achieved by setting ",(0,o.kt)("inlineCode",{parentName:"p"},"preserveForLookahead"),", making the keyframe be disabled, and then re-enabling it inside ",(0,o.kt)("inlineCode",{parentName:"p"},"onTimelineGenerate")," at the correct time."),(0,o.kt)("p",null,"It is possible to implement a 'next' AUX on your vision mixer by:"),(0,o.kt)("ul",null,(0,o.kt)("li",{parentName:"ul"},"Setup this mapping with ",(0,o.kt)("inlineCode",{parentName:"li"},"lookaheadDepth: 1")," and ",(0,o.kt)("inlineCode",{parentName:"li"},"lookahead: LookaheadMode.WHEN_CLEAR")),(0,o.kt)("li",{parentName:"ul"},"Each Part creates a TimelineObject on this mapping. Crucially, these have a priority of 0."),(0,o.kt)("li",{parentName:"ul"},"Lookahead will run and will insert its objects overriding your predefined ones (because of its higher priority). Resulting in the AUX always showing the lookahead object.")))}c.isMDXComponent=!0}}]);