"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[5357],{5318:(e,t,o)=>{o.d(t,{Zo:()=>d,kt:()=>h});var a=o(7378);function r(e,t,o){return t in e?Object.defineProperty(e,t,{value:o,enumerable:!0,configurable:!0,writable:!0}):e[t]=o,e}function n(e,t){var o=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),o.push.apply(o,a)}return o}function i(e){for(var t=1;t<arguments.length;t++){var o=null!=arguments[t]?arguments[t]:{};t%2?n(Object(o),!0).forEach((function(t){r(e,t,o[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(o)):n(Object(o)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(o,t))}))}return e}function l(e,t){if(null==e)return{};var o,a,r=function(e,t){if(null==e)return{};var o,a,r={},n=Object.keys(e);for(a=0;a<n.length;a++)o=n[a],t.indexOf(o)>=0||(r[o]=e[o]);return r}(e,t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);for(a=0;a<n.length;a++)o=n[a],t.indexOf(o)>=0||Object.prototype.propertyIsEnumerable.call(e,o)&&(r[o]=e[o])}return r}var p=a.createContext({}),s=function(e){var t=a.useContext(p),o=t;return e&&(o="function"==typeof e?e(t):i(i({},t),e)),o},d=function(e){var t=s(e.components);return a.createElement(p.Provider,{value:t},e.children)},c={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},m=a.forwardRef((function(e,t){var o=e.components,r=e.mdxType,n=e.originalType,p=e.parentName,d=l(e,["components","mdxType","originalType","parentName"]),m=s(o),h=r,u=m["".concat(p,".").concat(h)]||m[h]||c[h]||n;return o?a.createElement(u,i(i({ref:t},d),{},{components:o})):a.createElement(u,i({ref:t},d))}));function h(e,t){var o=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var n=o.length,i=new Array(n);i[0]=m;var l={};for(var p in t)hasOwnProperty.call(t,p)&&(l[p]=t[p]);l.originalType=e,l.mdxType="string"==typeof e?e:r,i[1]=l;for(var s=2;s<n;s++)i[s]=o[s];return a.createElement.apply(null,i)}return a.createElement.apply(null,o)}m.displayName="MDXCreateElement"},1562:(e,t,o)=>{o.r(t),o.d(t,{assets:()=>p,contentTitle:()=>i,default:()=>c,frontMatter:()=>n,metadata:()=>l,toc:()=>s});var a=o(5773),r=(o(7378),o(5318));const n={},i="Hold",l={unversionedId:"for-developers/for-blueprint-developers/hold",id:"for-developers/for-blueprint-developers/hold",title:"Hold",description:"Hold is a feature in Sofie to allow for a special form of take between two parts. It allows for the new part to start with some portions of the old part being retained, with the next 'take' stopping the remaining portions of the old part and not performing a true take.",source:"@site/docs/for-developers/for-blueprint-developers/hold.md",sourceDirName:"for-developers/for-blueprint-developers",slug:"/for-developers/for-blueprint-developers/hold",permalink:"/sofie-core/docs/for-developers/for-blueprint-developers/hold",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/docs/for-developers/for-blueprint-developers/hold.md",tags:[],version:"current",frontMatter:{},sidebar:"forDevelopers",previous:{title:"AB Playback",permalink:"/sofie-core/docs/for-developers/for-blueprint-developers/ab-playback"},next:{title:"Part and Piece Timings",permalink:"/sofie-core/docs/for-developers/for-blueprint-developers/part-and-piece-timings"}},p={},s=[{value:"Flow",id:"flow",level:2},{value:"Supporting Hold in blueprints",id:"supporting-hold-in-blueprints",level:2}],d={toc:s};function c(e){let{components:t,...n}=e;return(0,r.kt)("wrapper",(0,a.Z)({},d,n,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"hold"},"Hold"),(0,r.kt)("p",null,(0,r.kt)("em",{parentName:"p"},"Hold")," is a feature in Sofie to allow for a special form of take between two parts. It allows for the new part to start with some portions of the old part being retained, with the next 'take' stopping the remaining portions of the old part and not performing a true take."),(0,r.kt)("p",null,"For example, it could be setup to hold back the video when going between two clips, creating what is known in film editing as a ",(0,r.kt)("a",{parentName:"p",href:"https://en.wikipedia.org/wiki/Split_edit"},"split edit")," or ",(0,r.kt)("a",{parentName:"p",href:"https://en.wikipedia.org/wiki/J_cut"},"J-cut"),". The first ",(0,r.kt)("em",{parentName:"p"},"Take")," would start the audio from an ",(0,r.kt)("em",{parentName:"p"},"A-Roll")," (second clip), but keep the video playing from a ",(0,r.kt)("em",{parentName:"p"},"B-Roll")," (first clip). The second ",(0,r.kt)("em",{parentName:"p"},"Take")," would stop the first clip entirely, and join the audio and video for the second clip."),(0,r.kt)("p",null,(0,r.kt)("img",{alt:"A timeline of a J-Cut in a Non-Linear Video Editor",src:o(1602).Z,width:"470",height:"197"})),(0,r.kt)("h2",{id:"flow"},"Flow"),(0,r.kt)("p",null,"While ",(0,r.kt)("em",{parentName:"p"},"Hold")," is active or in progress, an indicator is shown in the header of the UI.",(0,r.kt)("br",{parentName:"p"}),"\n",(0,r.kt)("img",{alt:"_Hold_ in Rundown View header",src:o(6744).Z,width:"308",height:"117"})),(0,r.kt)("p",null,"It is not possible to run any adlibs while a hold is active, or to change the nexted part. Once it is in progress, it is not possible to abort or cancel the ",(0,r.kt)("em",{parentName:"p"},"Hold")," and it must be run to completion. If the second part has an autonext and that gets reached before the ",(0,r.kt)("em",{parentName:"p"},"Hold")," is completed, the ",(0,r.kt)("em",{parentName:"p"},"Hold")," will be treated as completed and the autonext will execute as normal."),(0,r.kt)("p",null,"When the part to be held is playing, with the correct part as next, the flow for the users is:"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Before",(0,r.kt)("ul",{parentName:"li"},(0,r.kt)("li",{parentName:"ul"},"Part A is playing"),(0,r.kt)("li",{parentName:"ul"},"Part B is nexted"))),(0,r.kt)("li",{parentName:"ul"},"Activate ",(0,r.kt)("em",{parentName:"li"},"Hold")," (By hotkey or other user action)",(0,r.kt)("ul",{parentName:"li"},(0,r.kt)("li",{parentName:"ul"},"Part A is playing"),(0,r.kt)("li",{parentName:"ul"},"Part B is nexted"))),(0,r.kt)("li",{parentName:"ul"},"Perform a take into the ",(0,r.kt)("em",{parentName:"li"},"Hold"),(0,r.kt)("ul",{parentName:"li"},(0,r.kt)("li",{parentName:"ul"},"Part B is playing"),(0,r.kt)("li",{parentName:"ul"},"Portions of Part A remain playing"))),(0,r.kt)("li",{parentName:"ul"},"Perform a take to complete the ",(0,r.kt)("em",{parentName:"li"},"Hold"),(0,r.kt)("ul",{parentName:"li"},(0,r.kt)("li",{parentName:"ul"},"Part B is playing")))),(0,r.kt)("p",null,"Before the take into the ",(0,r.kt)("em",{parentName:"p"},"Hold"),", it can be cancelled in the same way it was activated."),(0,r.kt)("h2",{id:"supporting-hold-in-blueprints"},"Supporting Hold in blueprints"),(0,r.kt)("div",{className:"admonition admonition-note alert alert--secondary"},(0,r.kt)("div",{parentName:"div",className:"admonition-heading"},(0,r.kt)("h5",{parentName:"div"},(0,r.kt)("span",{parentName:"h5",className:"admonition-icon"},(0,r.kt)("svg",{parentName:"span",xmlns:"http://www.w3.org/2000/svg",width:"14",height:"16",viewBox:"0 0 14 16"},(0,r.kt)("path",{parentName:"svg",fillRule:"evenodd",d:"M6.3 5.69a.942.942 0 0 1-.28-.7c0-.28.09-.52.28-.7.19-.18.42-.28.7-.28.28 0 .52.09.7.28.18.19.28.42.28.7 0 .28-.09.52-.28.7a1 1 0 0 1-.7.3c-.28 0-.52-.11-.7-.3zM8 7.99c-.02-.25-.11-.48-.31-.69-.2-.19-.42-.3-.69-.31H6c-.27.02-.48.13-.69.31-.2.2-.3.44-.31.69h1v3c.02.27.11.5.31.69.2.2.42.31.69.31h1c.27 0 .48-.11.69-.31.2-.19.3-.42.31-.69H8V7.98v.01zM7 2.3c-3.14 0-5.7 2.54-5.7 5.68 0 3.14 2.56 5.7 5.7 5.7s5.7-2.55 5.7-5.7c0-3.15-2.56-5.69-5.7-5.69v.01zM7 .98c3.86 0 7 3.14 7 7s-3.14 7-7 7-7-3.12-7-7 3.14-7 7-7z"}))),"note")),(0,r.kt)("div",{parentName:"div",className:"admonition-content"},(0,r.kt)("p",{parentName:"div"},"The functionality here is a bit limited, as it was originally written for one particular use-case and has not been expanded to support more complex scenarios.\nSome unanswered questions we have are:"),(0,r.kt)("ul",{parentName:"div"},(0,r.kt)("li",{parentName:"ul"},"Should ",(0,r.kt)("em",{parentName:"li"},"Hold")," be rewritten to be done with adlib-actions instead to allow for more complex scenarios?"),(0,r.kt)("li",{parentName:"ul"},"Should there be a way to more intelligently check if ",(0,r.kt)("em",{parentName:"li"},"Hold")," can be done between two Parts? (perhaps a new blueprint method?)")))),(0,r.kt)("p",null,"The blueprints have to label parts as supporting ",(0,r.kt)("em",{parentName:"p"},"Hold"),".",(0,r.kt)("br",{parentName:"p"}),"\n","You can do this with the ",(0,r.kt)("a",{parentName:"p",href:"https://nrkno.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.IBlueprintPart.html#holdMode"},(0,r.kt)("inlineCode",{parentName:"a"},"holdMode"))," property, and labelling it possible to ",(0,r.kt)("em",{parentName:"p"},"Hold")," from or to the part."),(0,r.kt)("p",null,"Note: If the user manipulates what part is set as next, they will be able to do a ",(0,r.kt)("em",{parentName:"p"},"Hold")," between parts that are not sequential in the Rundown."),(0,r.kt)("p",null,"You also have to label Pieces as something to extend into the ",(0,r.kt)("em",{parentName:"p"},"Hold"),". Not every piece will be wanted, so it is opt-in.",(0,r.kt)("br",{parentName:"p"}),"\n","You can do this with the ",(0,r.kt)("a",{parentName:"p",href:"https://nrkno.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.IBlueprintPiece.html#extendOnHold"},(0,r.kt)("inlineCode",{parentName:"a"},"extendOnHold"))," property. The pieces will get extended in the same way as infinite pieces, but limited to only be extended into the one part. The usual piece collision and priority logic applies."),(0,r.kt)("p",null,"Finally, you may find that there are some timeline objects that you don't want to use inside of the extended pieces, or there are some objects in the part that you don't want active while the ",(0,r.kt)("em",{parentName:"p"},"Hold")," is.",(0,r.kt)("br",{parentName:"p"}),"\n","You can mark an object with the ",(0,r.kt)("a",{parentName:"p",href:"https://nrkno.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.TimelineObjectCoreExt.html#holdMode"},(0,r.kt)("inlineCode",{parentName:"a"},"holdMode"))," property to specify its presence during a ",(0,r.kt)("em",{parentName:"p"},"Hold"),".",(0,r.kt)("br",{parentName:"p"}),"\n","The ",(0,r.kt)("inlineCode",{parentName:"p"},"HoldMode.ONLY")," mode tells the object to only be used when in a ",(0,r.kt)("em",{parentName:"p"},"Hold"),", which allows for doing some overrides in more complex scenarios."))}c.isMDXComponent=!0},6744:(e,t,o)=>{o.d(t,{Z:()=>a});const a="data:image/png;base64,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"},1602:(e,t,o)=>{o.d(t,{Z:()=>a});const a=o.p+"assets/images/video_edit_hold_j-cut-d8a28a338b28777cf60fc38948e93f67.png"}}]);