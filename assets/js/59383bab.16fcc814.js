"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[9954],{97167:(e,t,i)=>{i.r(t),i.d(t,{assets:()=>d,contentTitle:()=>a,default:()=>u,frontMatter:()=>o,metadata:()=>r,toc:()=>c});var s=i(62540),n=i(43023);const o={sidebar_label:"Introduction",sidebar_position:0},a="Sofie User Guide",r={id:"user-guide/intro",title:"Sofie User Guide",description:"Key Features",source:"@site/docs/user-guide/intro.md",sourceDirName:"user-guide",slug:"/user-guide/intro",permalink:"/sofie-core/docs/user-guide/intro",draft:!1,unlisted:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/docs/user-guide/intro.md",tags:[],version:"current",sidebarPosition:0,frontMatter:{sidebar_label:"Introduction",sidebar_position:0},sidebar:"userGuide",next:{title:"Concepts & Architecture",permalink:"/sofie-core/docs/user-guide/concepts-and-architecture"}},d={},c=[{value:"Key Features",id:"key-features",level:2},{value:"Web-based GUI",id:"web-based-gui",level:3},{value:"Modular Device Control",id:"modular-device-control",level:3},{value:"<em>State-based Playout</em>",id:"state-based-playout",level:3},{value:"Modular Data Ingest",id:"modular-data-ingest",level:3},{value:"Blueprints",id:"blueprints",level:3}];function l(e){const t={a:"a",admonition:"admonition",br:"br",em:"em",h1:"h1",h2:"h2",h3:"h3",img:"img",p:"p",...(0,n.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(t.h1,{id:"sofie-user-guide",children:"Sofie User Guide"}),"\n",(0,s.jsx)(t.h2,{id:"key-features",children:"Key Features"}),"\n",(0,s.jsx)(t.h3,{id:"web-based-gui",children:"Web-based GUI"}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.img,{alt:"Producer&#39;s / Director&#39;s  View",src:i(11534).A+"",width:"1548",height:"340"})}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.img,{alt:"Warnings and notifications are displayed to the user in the GUI",src:i(82307).A+"",width:"734",height:"337"})}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.img,{alt:"The Host view, displaying time information and countdowns",src:i(59379).A+"",width:"899",height:"553"})}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.img,{alt:"The prompter view",src:i(15116).A+"",width:"896",height:"554"})}),"\n",(0,s.jsx)(t.admonition,{type:"info",children:(0,s.jsxs)(t.p,{children:["Tip: The different web views (such as the host view and the prompter) can easily be transmitted over an SDI signal using the HTML producer in ",(0,s.jsx)(t.a,{href:"/sofie-core/docs/user-guide/installation/installing-connections-and-additional-hardware/casparcg-server-installation",children:"CasparCG"}),"."]})}),"\n",(0,s.jsx)(t.h3,{id:"modular-device-control",children:"Modular Device Control"}),"\n",(0,s.jsxs)(t.p,{children:["Sofie controls playout devices (such as vision and audio mixers, graphics and video playback) via the Playout Gateway, using the ",(0,s.jsx)(t.a,{href:"/sofie-core/docs/user-guide/concepts-and-architecture#timeline",children:"Timeline"}),".",(0,s.jsx)(t.br,{}),"\n","The Playout Gateway controls the devices and keeps track of their state and statuses, and lets the user know via the GUI if something's wrong that can affect the show."]}),"\n",(0,s.jsx)(t.h3,{id:"state-based-playout",children:(0,s.jsx)(t.em,{children:"State-based Playout"})}),"\n",(0,s.jsxs)(t.p,{children:["Sofie is using a state-based architecture to control playout. This means that each element in the show can be programmed independently - there's no need to take into account what has happened previously in the show; Sofie will make sure that the video is loaded and that the audio fader is tuned to the correct position, no matter what was played out previously.",(0,s.jsx)(t.br,{}),"\n","This allows the producer to skip ahead or move backwards in a show, without the fear of things going wrong on air."]}),"\n",(0,s.jsx)(t.h3,{id:"modular-data-ingest",children:"Modular Data Ingest"}),"\n",(0,s.jsxs)(t.p,{children:["Sofie features a modular ingest data-flow, allowing multiple types of input data to base rundowns on. Currently there is support for ",(0,s.jsx)(t.a,{href:"http://mosprotocol.com",children:"MOS-based"})," systems such as ENPS and iNEWS, as well as ",(0,s.jsx)(t.a,{href:"installation/installing-a-gateway/rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support",children:"Google Spreadsheets"}),", and more is in development."]}),"\n",(0,s.jsx)(t.h3,{id:"blueprints",children:"Blueprints"}),"\n",(0,s.jsxs)(t.p,{children:["The ",(0,s.jsx)(t.a,{href:"/sofie-core/docs/user-guide/concepts-and-architecture#blueprints",children:"Blueprints"})," are plugins to ",(0,s.jsx)(t.em,{children:"Sofie"}),", which allows for customization and tailor-made show designs.\nThe blueprints are made different depending on how the input data (rundowns) look like, how the show-design look like, and what devices to control."]})]})}function u(e={}){const{wrapper:t}={...(0,n.R)(),...e.components};return t?(0,s.jsx)(t,{...e,children:(0,s.jsx)(l,{...e})}):l(e)}},11534:(e,t,i)=>{i.d(t,{A:()=>s});const s=i.p+"assets/images/Sofie_GUI_example-b8fc23cc0ee1ec70414a75fc36f86227.jpg"},59379:(e,t,i)=>{i.d(t,{A:()=>s});const s=i.p+"assets/images/host-view-977a0371d7227a1d00402be9a4571acd.png"},15116:(e,t,i)=>{i.d(t,{A:()=>s});const s=i.p+"assets/images/prompter-view-520226a124a4c912728eddb9a8bb702e.png"},82307:(e,t,i)=>{i.d(t,{A:()=>s});const s=i.p+"assets/images/warnings-and-notifications-fac6c21018dd8f99f35e242966e1b144.png"},43023:(e,t,i)=>{i.d(t,{R:()=>a,x:()=>r});var s=i(63696);const n={},o=s.createContext(n);function a(e){const t=s.useContext(o);return s.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function r(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(n):e.components||n:a(e.components),s.createElement(o.Provider,{value:t},e.children)}}}]);