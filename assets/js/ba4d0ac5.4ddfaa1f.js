"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[929],{53590:(e,t,i)=>{i.r(t),i.d(t,{assets:()=>d,contentTitle:()=>r,default:()=>h,frontMatter:()=>o,metadata:()=>a,toc:()=>l});var s=i(62540),n=i(43023);const o={sidebar_position:1},r="Getting Started",a={id:"user-guide/installation/intro",title:"Getting Started",description:"Sofie can be installed in many different ways, depending on which platforms, needs, and features you desire. The Sofie system consists of several applications that work together to provide complete broadcast automation system. Each of these components' installation will be covered in this guide. Additional information about the products or services mentioned alongside the Sofie Installation can be found on the Further Reading.",source:"@site/versioned_docs/version-1.49.0/user-guide/installation/intro.md",sourceDirName:"user-guide/installation",slug:"/user-guide/installation/intro",permalink:"/sofie-core/docs/1.49.0/user-guide/installation/intro",draft:!1,unlisted:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.49.0/user-guide/installation/intro.md",tags:[],version:"1.49.0",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"userGuide",previous:{title:"System Health",permalink:"/sofie-core/docs/1.49.0/user-guide/features/system-health"},next:{title:"Quick install",permalink:"/sofie-core/docs/1.49.0/user-guide/installation/installing-sofie-server-core"}},d={},l=[{value:"Sofie Core View",id:"sofie-core-view",level:2},{value:"Sofie Core Overview",id:"sofie-core-overview",level:2},{value:"Gateways",id:"gateways",level:3},{value:"Blueprints",id:"blueprints",level:3}];function c(e){const t={a:"a",em:"em",h1:"h1",h2:"h2",h3:"h3",img:"img",p:"p",...(0,n.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(t.h1,{id:"getting-started",children:"Getting Started"}),"\n",(0,s.jsxs)(t.p,{children:[(0,s.jsx)(t.em,{children:"Sofie"})," can be installed in many different ways, depending on which platforms, needs, and features you desire. The ",(0,s.jsx)(t.em,{children:"Sofie"})," system consists of several applications that work together to provide complete broadcast automation system. Each of these components' installation will be covered in this guide. Additional information about the products or services mentioned alongside the Sofie Installation can be found on the ",(0,s.jsx)(t.a,{href:"/sofie-core/docs/1.49.0/user-guide/further-reading",children:"Further Reading"}),"."]}),"\n",(0,s.jsxs)(t.p,{children:["There are four minimum required components to get a Sofie system up and running. First you need the ",(0,s.jsx)(t.a,{href:"/sofie-core/docs/1.49.0/user-guide/installation/installing-sofie-server-core",children:(0,s.jsx)(t.em,{children:"Sofie\xa0Core"})}),", which is the brains of the operation. Then a set of ",(0,s.jsx)(t.a,{href:"/sofie-core/docs/1.49.0/user-guide/installation/installing-blueprints",children:(0,s.jsx)(t.em,{children:"Blueprints"})})," to handle and interpret incoming and outgoing data. Next, an ",(0,s.jsx)(t.a,{href:"/sofie-core/docs/1.49.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/intro",children:(0,s.jsx)(t.em,{children:"Ingest Gateway"})})," to fetch the data for the Blueprints. Then finally, a ",(0,s.jsx)(t.a,{href:"/sofie-core/docs/1.49.0/user-guide/installation/installing-a-gateway/playout-gateway",children:(0,s.jsx)(t.em,{children:"Playout\xa0Gateway"})})," to send the data to your playout device of choice."]}),"\n",(0,s.jsx)(t.h2,{id:"sofie-core-view",children:"Sofie Core View"}),"\n",(0,s.jsxs)(t.p,{children:["The ",(0,s.jsx)(t.em,{children:"Rundowns"})," view will display all the active rundowns that the ",(0,s.jsx)(t.em,{children:"Sofie\xa0Core"})," has access to."]}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.img,{alt:"Rundown View",src:i(33397).A+"",width:"879",height:"373"})}),"\n",(0,s.jsxs)(t.p,{children:["The ",(0,s.jsx)(t.em,{children:"Status"})," views displays the current status for the attached devices and gateways."]}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.img,{alt:"Status View \u2013 Describes the state of Sofie\xa0Core",src:i(38164).A+"",width:"879",height:"363"})}),"\n",(0,s.jsxs)(t.p,{children:["The ",(0,s.jsx)(t.em,{children:"Settings"})," views contains various settings for the studio, show styles, blueprints etc.. If the link to the settings view is not visible in your application, check your ",(0,s.jsx)(t.a,{href:"/sofie-core/docs/1.49.0/user-guide/features/access-levels",children:"Access Levels"}),". More info on specific parts of the ",(0,s.jsx)(t.em,{children:"Settings"})," view can be found in their corresponding guide sections."]}),"\n",(0,s.jsx)(t.p,{children:(0,s.jsx)(t.img,{alt:"Settings View \u2013 Describes how the Sofie\xa0Core is configured",src:i(89747).A+"",width:"879",height:"363"})}),"\n",(0,s.jsx)(t.h2,{id:"sofie-core-overview",children:"Sofie Core Overview"}),"\n",(0,s.jsxs)(t.p,{children:["The ",(0,s.jsx)(t.em,{children:"Sofie\xa0Core"})," is the primary application for managing the broadcast but, it doesn't play anything out on it's own. You need to use Gateways to establish the connection from the ",(0,s.jsx)(t.em,{children:"Sofie\xa0Core"})," to other pieces of hardware or remote software."]}),"\n",(0,s.jsx)(t.h3,{id:"gateways",children:"Gateways"}),"\n",(0,s.jsxs)(t.p,{children:["Gateways are separate applications that bridge the gap between the ",(0,s.jsx)(t.em,{children:"Sofie\xa0Core"})," and other pieces of hardware or services. At minimum, you will need a ",(0,s.jsx)(t.em,{children:"Playout Gateway"})," so your timeline can interact with your playout system of choice. To install the ",(0,s.jsx)(t.em,{children:"Playout Gateway"}),", visit the ",(0,s.jsx)(t.a,{href:"/sofie-core/docs/1.49.0/user-guide/installation/installing-a-gateway/intro",children:"Installing a Gateway"})," section of this guide and for a more in-depth look, please see ",(0,s.jsx)(t.a,{href:"/sofie-core/docs/1.49.0/user-guide/concepts-and-architecture#gateways",children:"Gateways"}),"."]}),"\n",(0,s.jsx)(t.h3,{id:"blueprints",children:"Blueprints"}),"\n",(0,s.jsxs)(t.p,{children:["Blueprints can be described as the logic that determines how a studio and show should interact with one another. They interpret the data coming in from the rundowns and transform them into a rich set of playable elements (",(0,s.jsx)(t.em,{children:"Segments"}),", ",(0,s.jsx)(t.em,{children:"Parts"}),", ",(0,s.jsx)(t.em,{children:"AdLibs,"})," etcetera). The ",(0,s.jsx)(t.em,{children:"Sofie\xa0Core"})," has three main blueprint types, ",(0,s.jsx)(t.em,{children:"System Blueprints"}),", ",(0,s.jsx)(t.em,{children:"Studio Blueprints"}),", and ",(0,s.jsx)(t.em,{children:"Showstyle Blueprints"}),". Installing ",(0,s.jsx)(t.em,{children:"Sofie"})," does not require you understand what these blueprints do, just that they are required for the ",(0,s.jsx)(t.em,{children:"Sofie\xa0Core"})," to work. If you would like to gain a deeper understand of how ",(0,s.jsx)(t.em,{children:"Blueprints"})," work, please visit the ",(0,s.jsx)(t.a,{href:"#blueprints",children:"Blueprints"})," section."]})]})}function h(e={}){const{wrapper:t}={...(0,n.R)(),...e.components};return t?(0,s.jsx)(t,{...e,children:(0,s.jsx)(c,{...e})}):c(e)}},33397:(e,t,i)=>{i.d(t,{A:()=>s});const s=i.p+"assets/images/rundowns-in-sofie-3ba51c8f67373b20734018c1c46e5348.png"},89747:(e,t,i)=>{i.d(t,{A:()=>s});const s=i.p+"assets/images/settings-page-60a492c413cffb97c791666ee464d03a.jpg"},38164:(e,t,i)=>{i.d(t,{A:()=>s});const s=i.p+"assets/images/status-page-30bbc08db37f9e6553908f0c247d0593.jpg"},43023:(e,t,i)=>{i.d(t,{R:()=>r,x:()=>a});var s=i(63696);const n={},o=s.createContext(n);function r(e){const t=s.useContext(o);return s.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(n):e.components||n:r(e.components),s.createElement(o.Provider,{value:t},e.children)}}}]);