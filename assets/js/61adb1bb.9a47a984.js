"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[3265],{8986:(e,t,a)=>{a.r(t),a.d(t,{assets:()=>s,contentTitle:()=>o,default:()=>d,frontMatter:()=>l,metadata:()=>n,toc:()=>c});var r=a(5773),i=(a(7378),a(5318));const l={sidebar_position:4},o="Supported Playout Devices",n={unversionedId:"user-guide/supported-devices",id:"version-1.38.0/user-guide/supported-devices",title:"Supported Playout Devices",description:"All playout devices are essentially driven through the timeline, which passes through Sofie&nbsp;Core into the Playout Gateway where it is processed by the timeline-state-resolver. This page details which devices and what parts of the devices can be controlled through the timeline-state-resolver library. In general a blueprints developer can use the timeline-state-resolver-types package to see the interfaces for the timeline objects used to control the devices.",source:"@site/versioned_docs/version-1.38.0/user-guide/supported-devices.md",sourceDirName:"user-guide",slug:"/user-guide/supported-devices",permalink:"/sofie-core/docs/1.38.0/user-guide/supported-devices",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.38.0/user-guide/supported-devices.md",tags:[],version:"1.38.0",sidebarPosition:4,frontMatter:{sidebar_position:4},sidebar:"version-1.38.0/userGuide",previous:{title:"Sofie Rundown Editor",permalink:"/sofie-core/docs/1.38.0/user-guide/installation/rundown-editor"},next:{title:"FAQ",permalink:"/sofie-core/docs/1.38.0/user-guide/faq"}},s={},c=[{value:'Blackmagic Design&#39;s ATEM Vision Mixers <a id="blackmagic-design-atem-vision-mixers"></a>',id:"blackmagic-designs-atem-vision-mixers-",level:2},{value:'CasparCG\xa0Server<a id="casparcg"></a>',id:"casparcgserver",level:2},{value:'HTTP Protocol <a id="http-protocol"></a>',id:"http-protocol-",level:2},{value:'Blackmagic Design HyperDeck <a id="blackmagic-design-hyperdeck"></a>',id:"blackmagic-design-hyperdeck-",level:2},{value:'Lawo Powercore &amp; MC2 Series <a id="lawo-powercore-and-mc2-series"></a>',id:"lawo-powercore--mc2-series-",level:2},{value:'OSC protocol <a id="osc-protocol"></a>',id:"osc-protocol-",level:2},{value:'Panasonic PTZ Cameras <a id="panasonic-ptz-cameras"></a>',id:"panasonic-ptz-cameras-",level:2},{value:'Pharos Lighting Control <a id="pharos-lighting-control"></a>',id:"pharos-lighting-control-",level:2},{value:'Grass Valley SQ Media Servers <a id="grass-valley-sq-media-servers"></a>',id:"grass-valley-sq-media-servers-",level:2},{value:'Shotoku Camera Robotics <a id="shotoku-camera-robotics"></a>',id:"shotoku-camera-robotics-",level:2},{value:'Singular Live <a id="singular-live"></a>',id:"singular-live-",level:2},{value:'Sisyfos <a id="sisyfos"></a>',id:"sisyfos-",level:2},{value:'TCP Protocol <a id="tcp-protocol"></a>',id:"tcp-protocol-",level:2},{value:'VizRT Viz MSE <a id="vizrt-viz-mse"></a>',id:"vizrt-viz-mse-",level:2},{value:'vMix <a id="vmix"></a>',id:"vmix-",level:2}],p={toc:c},u="wrapper";function d(e){let{components:t,...a}=e;return(0,i.kt)(u,(0,r.Z)({},p,a,{components:t,mdxType:"MDXLayout"}),(0,i.kt)("h1",{id:"supported-playout-devices"},"Supported Playout Devices"),(0,i.kt)("p",null,"All playout devices are essentially driven through the ",(0,i.kt)("em",{parentName:"p"},"timeline"),", which passes through ",(0,i.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," into the Playout Gateway where it is processed by the timeline-state-resolver. This page details which devices and what parts of the devices can be controlled through the timeline-state-resolver library. In general a blueprints developer can use the ",(0,i.kt)("a",{parentName:"p",href:"https://www.npmjs.com/package/timeline-state-resolver-types"},"timeline-state-resolver-types package")," to see the interfaces for the timeline objects used to control the devices."),(0,i.kt)("h2",{id:"blackmagic-designs-atem-vision-mixers-"},"Blackmagic Design's ATEM Vision Mixers ",(0,i.kt)("a",{id:"blackmagic-design-atem-vision-mixers"})),(0,i.kt)("p",null,"We support almost all features of these devices except fairlight audio, camera controls and streaming capabilities. A non-inclusive list:"),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Control of camera inputs"),(0,i.kt)("li",{parentName:"ul"},"Transitions"),(0,i.kt)("li",{parentName:"ul"},"Full control of keyers"),(0,i.kt)("li",{parentName:"ul"},"Full control of DVE's"),(0,i.kt)("li",{parentName:"ul"},"Control of media pools"),(0,i.kt)("li",{parentName:"ul"},"Control of auxilliaries")),(0,i.kt)("h2",{id:"casparcgserver"},"CasparCG","\xa0","Server",(0,i.kt)("a",{id:"casparcg"})),(0,i.kt)("p",null,"Tested and developed against ",(0,i.kt)("a",{parentName:"p",href:"https://github.com/nrkno/sofie-casparcg-server"},"a fork of version 2.1")," with more support for version 2.3 being added in the future."),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Video playback"),(0,i.kt)("li",{parentName:"ul"},"Graphics playback"),(0,i.kt)("li",{parentName:"ul"},"Recording / streaming"),(0,i.kt)("li",{parentName:"ul"},"Mixer parameters"),(0,i.kt)("li",{parentName:"ul"},"Transitions")),(0,i.kt)("h2",{id:"http-protocol-"},"HTTP Protocol ",(0,i.kt)("a",{id:"http-protocol"})),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Get/post/put/delete methods"),(0,i.kt)("li",{parentName:"ul"},"Interval based watcher for status monitoring")),(0,i.kt)("h2",{id:"blackmagic-design-hyperdeck-"},"Blackmagic Design HyperDeck ",(0,i.kt)("a",{id:"blackmagic-design-hyperdeck"})),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Recording")),(0,i.kt)("h2",{id:"lawo-powercore--mc2-series-"},"Lawo Powercore & MC2 Series ",(0,i.kt)("a",{id:"lawo-powercore-and-mc2-series"})),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Control over faders",(0,i.kt)("ul",{parentName:"li"},(0,i.kt)("li",{parentName:"ul"},"Using the ramp function on the powercore"))),(0,i.kt)("li",{parentName:"ul"},"Control of parameters in the ember tree")),(0,i.kt)("h2",{id:"osc-protocol-"},"OSC protocol ",(0,i.kt)("a",{id:"osc-protocol"})),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Sending of integers, floats, strings, blobs"),(0,i.kt)("li",{parentName:"ul"},"Tweening ","(","transitioning between",")"," values")),(0,i.kt)("p",null,"Can be configured in TCP or UDP mode."),(0,i.kt)("h2",{id:"panasonic-ptz-cameras-"},"Panasonic PTZ Cameras ",(0,i.kt)("a",{id:"panasonic-ptz-cameras"})),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Recalling presets"),(0,i.kt)("li",{parentName:"ul"},"Setting zoom, zoom speed and recall speed")),(0,i.kt)("h2",{id:"pharos-lighting-control-"},"Pharos Lighting Control ",(0,i.kt)("a",{id:"pharos-lighting-control"})),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Recalling scenes"),(0,i.kt)("li",{parentName:"ul"},"Recalling timelines")),(0,i.kt)("h2",{id:"grass-valley-sq-media-servers-"},"Grass Valley SQ Media Servers ",(0,i.kt)("a",{id:"grass-valley-sq-media-servers"})),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Control of playback"),(0,i.kt)("li",{parentName:"ul"},"Looping"),(0,i.kt)("li",{parentName:"ul"},"Cloning")),(0,i.kt)("p",null,(0,i.kt)("em",{parentName:"p"},"Note: some features are controlled through the media-manager")),(0,i.kt)("h2",{id:"shotoku-camera-robotics-"},"Shotoku Camera Robotics ",(0,i.kt)("a",{id:"shotoku-camera-robotics"})),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Cutting to shots"),(0,i.kt)("li",{parentName:"ul"},"Fading to shots")),(0,i.kt)("h2",{id:"singular-live-"},"Singular Live ",(0,i.kt)("a",{id:"singular-live"})),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Control nodes")),(0,i.kt)("p",null,(0,i.kt)("em",{parentName:"p"},"Note: this is not currently used in production by anyone we know of")),(0,i.kt)("h2",{id:"sisyfos-"},"Sisyfos ",(0,i.kt)("a",{id:"sisyfos"})),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"On-air controls"),(0,i.kt)("li",{parentName:"ul"},"Fader levels"),(0,i.kt)("li",{parentName:"ul"},"Labels"),(0,i.kt)("li",{parentName:"ul"},"Hide / show channels")),(0,i.kt)("h2",{id:"tcp-protocol-"},"TCP Protocol ",(0,i.kt)("a",{id:"tcp-protocol"})),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Sending messages")),(0,i.kt)("h2",{id:"vizrt-viz-mse-"},"VizRT Viz MSE ",(0,i.kt)("a",{id:"vizrt-viz-mse"})),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Pilot elements"),(0,i.kt)("li",{parentName:"ul"},"Continue commands"),(0,i.kt)("li",{parentName:"ul"},"Loading all elements"),(0,i.kt)("li",{parentName:"ul"},"Clearing all elements")),(0,i.kt)("h2",{id:"vmix-"},"vMix ",(0,i.kt)("a",{id:"vmix"})),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Full M/E control"),(0,i.kt)("li",{parentName:"ul"},"Audio control"),(0,i.kt)("li",{parentName:"ul"},"Streaming / recording control"),(0,i.kt)("li",{parentName:"ul"},"Fade to black"),(0,i.kt)("li",{parentName:"ul"},"Overlays"),(0,i.kt)("li",{parentName:"ul"},"Transforms"),(0,i.kt)("li",{parentName:"ul"},"Transitions")))}d.isMDXComponent=!0},5318:(e,t,a)=>{a.d(t,{Zo:()=>p,kt:()=>k});var r=a(7378);function i(e,t,a){return t in e?Object.defineProperty(e,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[t]=a,e}function l(e,t){var a=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),a.push.apply(a,r)}return a}function o(e){for(var t=1;t<arguments.length;t++){var a=null!=arguments[t]?arguments[t]:{};t%2?l(Object(a),!0).forEach((function(t){i(e,t,a[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(a)):l(Object(a)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(a,t))}))}return e}function n(e,t){if(null==e)return{};var a,r,i=function(e,t){if(null==e)return{};var a,r,i={},l=Object.keys(e);for(r=0;r<l.length;r++)a=l[r],t.indexOf(a)>=0||(i[a]=e[a]);return i}(e,t);if(Object.getOwnPropertySymbols){var l=Object.getOwnPropertySymbols(e);for(r=0;r<l.length;r++)a=l[r],t.indexOf(a)>=0||Object.prototype.propertyIsEnumerable.call(e,a)&&(i[a]=e[a])}return i}var s=r.createContext({}),c=function(e){var t=r.useContext(s),a=t;return e&&(a="function"==typeof e?e(t):o(o({},t),e)),a},p=function(e){var t=c(e.components);return r.createElement(s.Provider,{value:t},e.children)},u="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},m=r.forwardRef((function(e,t){var a=e.components,i=e.mdxType,l=e.originalType,s=e.parentName,p=n(e,["components","mdxType","originalType","parentName"]),u=c(a),m=i,k=u["".concat(s,".").concat(m)]||u[m]||d[m]||l;return a?r.createElement(k,o(o({ref:t},p),{},{components:a})):r.createElement(k,o({ref:t},p))}));function k(e,t){var a=arguments,i=t&&t.mdxType;if("string"==typeof e||i){var l=a.length,o=new Array(l);o[0]=m;var n={};for(var s in t)hasOwnProperty.call(t,s)&&(n[s]=t[s]);n.originalType=e,n[u]="string"==typeof e?e:i,o[1]=n;for(var c=2;c<l;c++)o[c]=a[c];return r.createElement.apply(null,o)}return r.createElement.apply(null,a)}m.displayName="MDXCreateElement"}}]);