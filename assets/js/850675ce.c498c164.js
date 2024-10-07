"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[6088],{51357:(e,n,r)=>{r.r(n),r.d(n,{assets:()=>l,contentTitle:()=>o,default:()=>d,frontMatter:()=>t,metadata:()=>a,toc:()=>c});var s=r(62540),i=r(43023);const t={description:"List of all repositories related to Sofie",sidebar_position:5},o="Applications & Libraries",a={id:"for-developers/libraries",title:"Applications & Libraries",description:"List of all repositories related to Sofie",source:"@site/versioned_docs/version-1.47.0/for-developers/libraries.md",sourceDirName:"for-developers",slug:"/for-developers/libraries",permalink:"/sofie-core/docs/1.47.0/for-developers/libraries",draft:!1,unlisted:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.47.0/for-developers/libraries.md",tags:[],version:"1.47.0",sidebarPosition:5,frontMatter:{description:"List of all repositories related to Sofie",sidebar_position:5},sidebar:"forDevelopers",previous:{title:"Timeline Datastore",permalink:"/sofie-core/docs/1.47.0/for-developers/for-blueprint-developers/timeline-datastore"},next:{title:"API Documentation",permalink:"/sofie-core/docs/1.47.0/for-developers/api-documentation"}},l={},c=[{value:"Main Application",id:"main-application",level:2},{value:"Gateways",id:"gateways",level:2},{value:"Libraries",id:"libraries",level:2},{value:"Other Sofie-related Repositories",id:"other-sofie-related-repositories",level:2}];function h(e){const n={a:"a",em:"em",h1:"h1",h2:"h2",li:"li",p:"p",strong:"strong",ul:"ul",...(0,i.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.h1,{id:"applications--libraries",children:"Applications & Libraries"}),"\n",(0,s.jsx)(n.h2,{id:"main-application",children:"Main Application"}),"\n",(0,s.jsxs)(n.p,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-core",children:(0,s.jsx)(n.strong,{children:"Sofie\xa0Core"})})," is the main application that serves the web GUI and handles the core logic."]}),"\n",(0,s.jsx)(n.h2,{id:"gateways",children:"Gateways"}),"\n",(0,s.jsxs)(n.p,{children:["Together with the ",(0,s.jsx)(n.em,{children:"Sofie\xa0Core"})," there are several ",(0,s.jsx)(n.em,{children:"gateways"})," which are separate applications, but which connect to ",(0,s.jsx)(n.em,{children:"Sofie\xa0Core"})," and are managed from within the Core's web UI."]}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-core/tree/master/packages/playout-gateway",children:(0,s.jsx)(n.strong,{children:"Playout Gateway"})})," Handles the playout from ",(0,s.jsx)(n.em,{children:"Sofie"}),". Connects to and controls a multitude of devices, such as vision mixers, graphics, light controllers, audio mixers etc.."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-core/tree/master/packages/mos-gateway",children:(0,s.jsx)(n.strong,{children:"MOS Gateway"})})," Connects ",(0,s.jsx)(n.em,{children:"Sofie"})," to a newsroom system (NRCS) and ingests rundowns via the ",(0,s.jsx)(n.a,{href:"http://mosprotocol.com/",children:"MOS protocol"}),"."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/tv2/inews-ftp-gateway",children:(0,s.jsx)(n.strong,{children:"iNEWS Gateway"})})," Connects ",(0,s.jsx)(n.em,{children:"Sofie"})," to an Avid iNEWS newsroom system."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-quantel-gateway",children:(0,s.jsx)(n.strong,{children:"Quantel Gateway"})})," CORBA to REST gateway for ",(0,s.jsx)(n.em,{children:"Quantel/ISA"})," playback."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/SuperFlyTV/spreadsheet-gateway",children:(0,s.jsx)(n.strong,{children:"Spreadsheet Gateway"})})," Connects ",(0,s.jsx)(n.em,{children:"Sofie"})," to a ",(0,s.jsx)(n.em,{children:"Google Drive"})," folder and ingests rundowns from ",(0,s.jsx)(n.em,{children:"Google Sheets"}),"."]}),"\n",(0,s.jsx)(n.li,{children:(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-input-gateway",children:(0,s.jsx)(n.strong,{children:"Input Gateway"})})}),"\n"]}),"\n",(0,s.jsx)(n.h2,{id:"libraries",children:"Libraries"}),"\n",(0,s.jsx)(n.p,{children:"There are a number of libraries used in the Sofie ecosystem:"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-atem-connection",children:(0,s.jsx)(n.strong,{children:"ATEM Connection"})})," Library for communicating with Blackmagic Design's ATEM mixers"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-atem-state",children:(0,s.jsx)(n.strong,{children:"ATEM State"})}),"  Used in TSR to tracks the state of ATEMs and generate commands to control them."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/SuperFlyTV/casparcg-connection",children:(0,s.jsx)(n.strong,{children:"CasparCG\xa0Server Connection"})})," developed by ",(0,s.jsx)(n.strong,{children:(0,s.jsx)(n.a,{href:"https://github.com/SuperFlyTV",children:(0,s.jsx)(n.em,{children:"SuperFly.tv"})})})," Library to connect and interact with CasparCG\xa0Servers."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/superflytv/casparcg-state",children:(0,s.jsx)(n.strong,{children:"CasparCG State"})})," developed by ",(0,s.jsx)(n.strong,{children:(0,s.jsx)(n.a,{href:"https://github.com/SuperFlyTV",children:(0,s.jsx)(n.em,{children:"SuperFly.tv"})})})," Used in TSR to tracks the state of CasparCG\xa0Servers and generate commands to control them."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-emberplus-connection",children:(0,s.jsx)(n.strong,{children:"Ember+ Connection"})})," Library to communicate with ",(0,s.jsx)(n.em,{children:"Ember+"})," control protocol"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-hyperdeck-connection",children:(0,s.jsx)(n.strong,{children:"HyperDeck Connection"})})," Library for connecting to Blackmagic Design's HyperDeck recorders."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-mos-connection/",children:(0,s.jsx)(n.strong,{children:"MOS Connection"})})," A ",(0,s.jsx)(n.a,{href:"http://mosprotocol.com/",children:(0,s.jsx)(n.em,{children:"MOS protocol"})})," library for acting as a MOS device and connecting to an newsroom control system."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-quantel-gateway-client",children:(0,s.jsx)(n.strong,{children:"Quantel Gateway Client"})})," An interface that talks to the Quantel-Gateway application."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-core-integration",children:(0,s.jsx)(n.strong,{children:"Sofie\xa0Core Integration"})})," Used to connect to the ",(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-core",children:"Sofie\xa0Core"})," by the Gateways."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-sofie-blueprints-integration",children:(0,s.jsx)(n.strong,{children:"Sofie Blueprints Integration"})})," Common types and interfaces used by both Sofie\xa0Core and the user-defined blueprints."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/SuperFlyTV/supertimeline",children:(0,s.jsx)(n.strong,{children:"SuperFly-Timeline"})})," developed by ",(0,s.jsx)(n.strong,{children:(0,s.jsx)(n.a,{href:"https://github.com/SuperFlyTV",children:(0,s.jsx)(n.em,{children:"SuperFly.tv"})})})," Resolver and rules for placing objects on a virtual timeline."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nytamin/threadedClass",children:(0,s.jsx)(n.strong,{children:"ThreadedClass"})})," developed by ",(0,s.jsx)(n.strong,{children:(0,s.jsx)(n.a,{href:"https://github.com/nytamin",children:(0,s.jsx)(n.em,{children:"Nytamin"})})})," Used in TSR to spawn device controllers in separate processes."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-timeline-state-resolver",children:(0,s.jsx)(n.strong,{children:"Timeline State Resolver"})})," (TSR) The main driver in ",(0,s.jsx)(n.strong,{children:"Playout Gateway,"})," handles connections to playout-devices and sends commands based on a ",(0,s.jsx)(n.strong,{children:"Timeline"})," received from ",(0,s.jsx)(n.strong,{children:"Core"}),"."]}),"\n"]}),"\n",(0,s.jsx)(n.p,{children:"There are also a few typings-only libraries that define interfaces between applications:"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://www.npmjs.com/package/@sofie-automation/blueprints-integration",children:(0,s.jsx)(n.strong,{children:"Blueprints Integration"})})," Defines the interface between ",(0,s.jsx)(n.a,{href:"/sofie-core/docs/1.47.0/user-guide/concepts-and-architecture#blueprints",children:(0,s.jsx)(n.strong,{children:"Blueprints"})})," and ",(0,s.jsx)(n.strong,{children:"Sofie\xa0Core"}),"."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://www.npmjs.com/package/timeline-state-resolver-types",children:(0,s.jsx)(n.strong,{children:"Timeline State Resolver types"})})," Defines the interface between ",(0,s.jsx)(n.a,{href:"/sofie-core/docs/1.47.0/user-guide/concepts-and-architecture#blueprints",children:(0,s.jsx)(n.strong,{children:"Blueprints"})})," and the timeline that will be fed into ",(0,s.jsx)(n.strong,{children:"TSR"})," for playout."]}),"\n"]}),"\n",(0,s.jsx)(n.h2,{id:"other-sofie-related-repositories",children:"Other Sofie-related Repositories"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsxs)(n.a,{href:"https://github.com/nrkno/sofie-casparcg-server",children:[(0,s.jsx)(n.strong,{children:"CasparCG\xa0Server"})," (NRK fork)"]})," Sofie-specific fork of CasparCG\xa0Server."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-casparcg-launcher",children:(0,s.jsx)(n.strong,{children:"CasparCG Launcher"})})," Launcher, controller, and logger for CasparCG\xa0Server."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsxs)(n.a,{href:"https://github.com/nrkno/sofie-casparcg-server",children:[(0,s.jsx)(n.strong,{children:"CasparCG Media Scanner"})," (NRK fork)"]})," Sofie-specific fork of CasparCG\xa0Server 2.2 Media\xa0Scanner."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-package-manager",children:(0,s.jsx)(n.strong,{children:"Package Manager"})})," Handles media asset transfer and media file management for pulling new files and deleting expired files on playout devices in a more performant, and possibly distributed, way. Can smartly figure out how to get a file on storage A to playout server B."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-media-management",children:(0,s.jsx)(n.strong,{children:"Media Manager"})})," ",(0,s.jsx)(n.em,{children:"(deprecated)"})," Handles media transfer and media file management for pulling new files and deleting expired files on playout devices."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-quantel-browser-plugin",children:(0,s.jsx)(n.strong,{children:"Quantel Browser Plugin"})})," MOS-compatible Quantel video clip browser for use with Sofie."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.a,{href:"https://github.com/nrkno/sofie-sisyfos-audio-controller",children:(0,s.jsx)(n.strong,{children:"Sisyfos Audio Controller"})})," ",(0,s.jsxs)(n.em,{children:["developed by ",(0,s.jsx)(n.a,{href:"https://github.com/olzzon/",children:(0,s.jsx)(n.em,{children:"olzzon"})})]})]}),"\n"]})]})}function d(e={}){const{wrapper:n}={...(0,i.R)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(h,{...e})}):h(e)}},43023:(e,n,r)=>{r.d(n,{R:()=>o,x:()=>a});var s=r(63696);const i={},t=s.createContext(i);function o(e){const n=s.useContext(t);return s.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function a(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:o(e.components),s.createElement(t.Provider,{value:n},e.children)}}}]);