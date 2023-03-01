"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[1959],{5318:(e,t,a)=>{a.d(t,{Zo:()=>m,kt:()=>f});var r=a(7378);function n(e,t,a){return t in e?Object.defineProperty(e,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[t]=a,e}function o(e,t){var a=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),a.push.apply(a,r)}return a}function i(e){for(var t=1;t<arguments.length;t++){var a=null!=arguments[t]?arguments[t]:{};t%2?o(Object(a),!0).forEach((function(t){n(e,t,a[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(a)):o(Object(a)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(a,t))}))}return e}function s(e,t){if(null==e)return{};var a,r,n=function(e,t){if(null==e)return{};var a,r,n={},o=Object.keys(e);for(r=0;r<o.length;r++)a=o[r],t.indexOf(a)>=0||(n[a]=e[a]);return n}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(r=0;r<o.length;r++)a=o[r],t.indexOf(a)>=0||Object.prototype.propertyIsEnumerable.call(e,a)&&(n[a]=e[a])}return n}var l=r.createContext({}),p=function(e){var t=r.useContext(l),a=t;return e&&(a="function"==typeof e?e(t):i(i({},t),e)),a},m=function(e){var t=p(e.components);return r.createElement(l.Provider,{value:t},e.children)},c={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},u=r.forwardRef((function(e,t){var a=e.components,n=e.mdxType,o=e.originalType,l=e.parentName,m=s(e,["components","mdxType","originalType","parentName"]),u=p(a),f=n,k=u["".concat(l,".").concat(f)]||u[f]||c[f]||o;return a?r.createElement(k,i(i({ref:t},m),{},{components:a})):r.createElement(k,i({ref:t},m))}));function f(e,t){var a=arguments,n=t&&t.mdxType;if("string"==typeof e||n){var o=a.length,i=new Array(o);i[0]=u;var s={};for(var l in t)hasOwnProperty.call(t,l)&&(s[l]=t[l]);s.originalType=e,s.mdxType="string"==typeof e?e:n,i[1]=s;for(var p=2;p<o;p++)i[p]=a[p];return r.createElement.apply(null,i)}return r.createElement.apply(null,a)}u.displayName="MDXCreateElement"},2519:(e,t,a)=>{a.r(t),a.d(t,{assets:()=>l,contentTitle:()=>i,default:()=>c,frontMatter:()=>o,metadata:()=>s,toc:()=>p});var r=a(5773),n=(a(7378),a(5318));const o={description:"List of all repositories related to Sofie",sidebar_position:5},i="Applications & Libraries",s={unversionedId:"for-developers/libraries",id:"version-1.46.0/for-developers/libraries",title:"Applications & Libraries",description:"List of all repositories related to Sofie",source:"@site/versioned_docs/version-1.46.0/for-developers/libraries.md",sourceDirName:"for-developers",slug:"/for-developers/libraries",permalink:"/sofie-core/docs/1.46.0/for-developers/libraries",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.46.0/for-developers/libraries.md",tags:[],version:"1.46.0",sidebarPosition:5,frontMatter:{description:"List of all repositories related to Sofie",sidebar_position:5},sidebar:"version-1.45.0/forDevelopers",previous:{title:"Timeline Datastore",permalink:"/sofie-core/docs/1.46.0/for-developers/for-blueprint-developers/timeline-datastore"},next:{title:"API Documentation",permalink:"/sofie-core/docs/1.46.0/for-developers/api-documentation"}},l={},p=[{value:"Main Application",id:"main-application",level:2},{value:"Gateways",id:"gateways",level:2},{value:"Libraries",id:"libraries",level:2},{value:"Other Sofie-related Repositories",id:"other-sofie-related-repositories",level:2}],m={toc:p};function c(e){let{components:t,...a}=e;return(0,n.kt)("wrapper",(0,r.Z)({},m,a,{components:t,mdxType:"MDXLayout"}),(0,n.kt)("h1",{id:"applications--libraries"},"Applications & Libraries"),(0,n.kt)("h2",{id:"main-application"},"Main Application"),(0,n.kt)("p",null,(0,n.kt)("a",{parentName:"p",href:"https://github.com/nrkno/sofie-core"},(0,n.kt)("strong",{parentName:"a"},"Sofie","\xa0","Core"))," is the main application that serves the web GUI and handles the core logic."),(0,n.kt)("h2",{id:"gateways"},"Gateways"),(0,n.kt)("p",null,"Together with the ",(0,n.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," there are several ",(0,n.kt)("em",{parentName:"p"},"gateways")," which are separate applications, but which connect to ",(0,n.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," and are managed from within the Core's web UI."),(0,n.kt)("ul",null,(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-core/tree/master/packages/playout-gateway"},(0,n.kt)("strong",{parentName:"a"},"Playout Gateway"))," Handles the playout from ",(0,n.kt)("em",{parentName:"li"},"Sofie"),". Connects to and controls a multitude of devices, such as vision mixers, graphics, light controllers, audio mixers etc.."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-core/tree/master/packages/mos-gateway"},(0,n.kt)("strong",{parentName:"a"},"MOS Gateway"))," Connects ",(0,n.kt)("em",{parentName:"li"},"Sofie")," to a newsroom system ","(","NRCS",")"," and ingests rundowns via the ",(0,n.kt)("a",{parentName:"li",href:"http://mosprotocol.com/"},"MOS protocol"),"."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/tv2/inews-ftp-gateway"},(0,n.kt)("strong",{parentName:"a"},"iNEWS Gateway"))," Connects ",(0,n.kt)("em",{parentName:"li"},"Sofie")," to an Avid iNEWS newsroom system."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-quantel-gateway"},(0,n.kt)("strong",{parentName:"a"},"Quantel Gateway"))," CORBA to REST gateway for ",(0,n.kt)("em",{parentName:"li"},"Quantel/ISA")," playback. "),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/SuperFlyTV/spreadsheet-gateway"},(0,n.kt)("strong",{parentName:"a"},"Spreadsheet Gateway"))," Connects ",(0,n.kt)("em",{parentName:"li"},"Sofie")," to a ",(0,n.kt)("em",{parentName:"li"},"Google Drive")," folder and ingests rundowns from ",(0,n.kt)("em",{parentName:"li"},"Google Sheets"),"."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-input-gateway"},(0,n.kt)("strong",{parentName:"a"},"Input Gateway"))," ")),(0,n.kt)("h2",{id:"libraries"},"Libraries"),(0,n.kt)("p",null,"There are a number of libraries used in the Sofie ecosystem:"),(0,n.kt)("ul",null,(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-atem-connection"},(0,n.kt)("strong",{parentName:"a"},"ATEM Connection"))," Library for communicating with Blackmagic Design's ATEM mixers"),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-atem-state"},(0,n.kt)("strong",{parentName:"a"},"ATEM State")),"  Used in TSR to tracks the state of ATEMs and generate commands to control them."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/SuperFlyTV/casparcg-connection"},(0,n.kt)("strong",{parentName:"a"},"CasparCG","\xa0","Server Connection"))," developed by ",(0,n.kt)("strong",{parentName:"li"},(0,n.kt)("a",{parentName:"strong",href:"https://github.com/SuperFlyTV"},(0,n.kt)("em",{parentName:"a"},"SuperFly.tv")))," Library to connect and interact with CasparCG","\xa0","Servers."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/superflytv/casparcg-state"},(0,n.kt)("strong",{parentName:"a"},"CasparCG State"))," developed by ",(0,n.kt)("strong",{parentName:"li"},(0,n.kt)("a",{parentName:"strong",href:"https://github.com/SuperFlyTV"},(0,n.kt)("em",{parentName:"a"},"SuperFly.tv")))," Used in TSR to tracks the state of CasparCG","\xa0","Servers and generate commands to control them."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-emberplus-connection"},(0,n.kt)("strong",{parentName:"a"},"Ember+ Connection"))," Library to communicate with ",(0,n.kt)("em",{parentName:"li"},"Ember+")," control protocol "),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-hyperdeck-connection"},(0,n.kt)("strong",{parentName:"a"},"HyperDeck Connection"))," Library for connecting to Blackmagic Design's HyperDeck recorders."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-mos-connection/"},(0,n.kt)("strong",{parentName:"a"},"MOS Connection"))," A ",(0,n.kt)("a",{parentName:"li",href:"http://mosprotocol.com/"},(0,n.kt)("em",{parentName:"a"},"MOS protocol"))," library for acting as a MOS device and connecting to an newsroom control system."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-quantel-gateway-client"},(0,n.kt)("strong",{parentName:"a"},"Quantel Gateway Client"))," An interface that talks to the Quantel-Gateway application."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-core-integration"},(0,n.kt)("strong",{parentName:"a"},"Sofie","\xa0","Core Integration"))," Used to connect to the ",(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-core"},"Sofie","\xa0","Core")," by the Gateways."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-sofie-blueprints-integration"},(0,n.kt)("strong",{parentName:"a"},"Sofie Blueprints Integration"))," Common types and interfaces used by both Sofie","\xa0","Core and the user-defined blueprints."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/SuperFlyTV/supertimeline"},(0,n.kt)("strong",{parentName:"a"},"SuperFly-Timeline"))," developed by ",(0,n.kt)("strong",{parentName:"li"},(0,n.kt)("a",{parentName:"strong",href:"https://github.com/SuperFlyTV"},(0,n.kt)("em",{parentName:"a"},"SuperFly.tv")))," Resolver and rules for placing objects on a virtual timeline."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nytamin/threadedClass"},(0,n.kt)("strong",{parentName:"a"},"ThreadedClass"))," developed by ",(0,n.kt)("strong",{parentName:"li"},(0,n.kt)("a",{parentName:"strong",href:"https://github.com/nytamin"},(0,n.kt)("em",{parentName:"a"},"Nytamin")))," Used in TSR to spawn device controllers in separate processes."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-timeline-state-resolver"},(0,n.kt)("strong",{parentName:"a"},"Timeline State Resolver"))," ","(","TSR",")"," The main driver in ",(0,n.kt)("strong",{parentName:"li"},"Playout Gateway,")," handles connections to playout-devices and sends commands based on a ",(0,n.kt)("strong",{parentName:"li"},"Timeline")," received from ",(0,n.kt)("strong",{parentName:"li"},"Core"),".")),(0,n.kt)("p",null,"There are also a few typings-only libraries that define interfaces between applications:"),(0,n.kt)("ul",null,(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://www.npmjs.com/package/@sofie-automation/blueprints-integration"},(0,n.kt)("strong",{parentName:"a"},"Blueprints Integration"))," Defines the interface between ",(0,n.kt)("a",{parentName:"li",href:"../user-guide/concepts-and-architecture#blueprints"},(0,n.kt)("strong",{parentName:"a"},"Blueprints"))," and ",(0,n.kt)("strong",{parentName:"li"},"Sofie","\xa0","Core"),"."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://www.npmjs.com/package/timeline-state-resolver-types"},(0,n.kt)("strong",{parentName:"a"},"Timeline State Resolver types"))," Defines the interface between ",(0,n.kt)("a",{parentName:"li",href:"../user-guide/concepts-and-architecture#blueprints"},(0,n.kt)("strong",{parentName:"a"},"Blueprints"))," and the timeline that will be fed into ",(0,n.kt)("strong",{parentName:"li"},"TSR")," for playout.")),(0,n.kt)("h2",{id:"other-sofie-related-repositories"},"Other Sofie-related Repositories"),(0,n.kt)("ul",null,(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-casparcg-server"},(0,n.kt)("strong",{parentName:"a"},"CasparCG","\xa0","Server")," ","(","NRK fork",")")," Sofie-specific fork of CasparCG","\xa0","Server."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-casparcg-launcher"},(0,n.kt)("strong",{parentName:"a"},"CasparCG Launcher"))," Launcher, controller, and logger for CasparCG","\xa0","Server."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-casparcg-server"},(0,n.kt)("strong",{parentName:"a"},"CasparCG Media Scanner")," ","(","NRK fork",")")," Sofie-specific fork of CasparCG","\xa0","Server 2.2 Media","\xa0","Scanner."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-package-manager"},(0,n.kt)("strong",{parentName:"a"},"Package Manager"))," Handles media asset transfer and media file management for pulling new files and deleting expired files on playout devices in a more performant, and possibly distributed, way. Can smartly figure out how to get a file on storage A to playout server B."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-media-management"},(0,n.kt)("strong",{parentName:"a"},"Media Manager"))," ",(0,n.kt)("em",{parentName:"li"},"(deprecated)")," Handles media transfer and media file management for pulling new files and deleting expired files on playout devices."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-quantel-browser-plugin"},(0,n.kt)("strong",{parentName:"a"},"Quantel Browser Plugin"))," MOS-compatible Quantel video clip browser for use with Sofie."),(0,n.kt)("li",{parentName:"ul"},(0,n.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-sisyfos-audio-controller"},(0,n.kt)("strong",{parentName:"a"},"Sisyfos Audio Controller"))," ",(0,n.kt)("em",{parentName:"li"},"developed by ",(0,n.kt)("a",{parentName:"em",href:"https://github.com/olzzon/"},(0,n.kt)("em",{parentName:"a"},"olzzon"))))))}c.isMDXComponent=!0}}]);