"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[7981],{68663:(e,s,t)=>{t.r(s),t.d(s,{assets:()=>a,contentTitle:()=>l,default:()=>h,frontMatter:()=>o,metadata:()=>d,toc:()=>r});var i=t(62540),n=t(43023);const o={sidebar_position:3},l="Access Levels",d={id:"user-guide/features/access-levels",title:"Access Levels",description:"A variety of access levels can be set via the URL. By default, a user cannot edit settings, nor play out anything. Some of the access levels provide additional administrative pages or helpful tool tips for new users. These modes are persistent between sessions and will need to be manually disabled by replacing the 1 with a 0 in the URL. Below is a quick reference to the modes and what they have access to.",source:"@site/docs/user-guide/features/access-levels.md",sourceDirName:"user-guide/features",slug:"/user-guide/features/access-levels",permalink:"/sofie-core/docs/user-guide/features/access-levels",draft:!1,unlisted:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/docs/user-guide/features/access-levels.md",tags:[],version:"current",sidebarPosition:3,frontMatter:{sidebar_position:3},sidebar:"userGuide",previous:{title:"Sofie Views",permalink:"/sofie-core/docs/user-guide/features/sofie-views"},next:{title:"Prompter",permalink:"/sofie-core/docs/user-guide/features/prompter"}},a={},r=[{value:"Basic mode",id:"basic-mode",level:3},{value:"Studio mode",id:"studio-mode",level:3},{value:"Configuration mode",id:"configuration-mode",level:3},{value:"Help Mode",id:"help-mode",level:3},{value:"Admin Mode",id:"admin-mode",level:3},{value:"Testing Mode",id:"testing-mode",level:3},{value:"Developer Mode",id:"developer-mode",level:3}];function c(e){const s={a:"a",code:"code",em:"em",h1:"h1",h3:"h3",p:"p",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...(0,n.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(s.h1,{id:"access-levels",children:"Access Levels"}),"\n",(0,i.jsxs)(s.p,{children:["A variety of access levels can be set via the URL. By default, a user cannot edit settings, nor play out anything. Some of the access levels provide additional administrative pages or helpful tool tips for new users. These modes are persistent between sessions and will need to be manually disabled by replacing the ",(0,i.jsx)(s.em,{children:"1"})," with a ",(0,i.jsx)(s.em,{children:"0"})," in the URL. Below is a quick reference to the modes and what they have access to."]}),"\n",(0,i.jsxs)(s.p,{children:["If user accounts are enabled (",(0,i.jsx)(s.code,{children:"enableUserAccounts"})," in ",(0,i.jsxs)(s.a,{href:"../configuration/sofie-core-settings#settings-file",children:[(0,i.jsx)(s.em,{children:"Sofie\xa0Core"})," settings"]}),"), the access levels are set under the user settings. If no user accounts are set, the access level for a browser is set by adding ",(0,i.jsx)(s.code,{children:"?theaccessmode=1"})," to the URL as described below."]}),"\n",(0,i.jsxs)(s.p,{children:["The access level is persisted in browser's Local Storage. To disable, visit",(0,i.jsx)(s.code,{children:"?theaccessmode=0"}),"."]}),"\n",(0,i.jsxs)(s.table,{children:[(0,i.jsx)(s.thead,{children:(0,i.jsxs)(s.tr,{children:[(0,i.jsx)(s.th,{style:{textAlign:"left"},children:"Access area"}),(0,i.jsx)(s.th,{style:{textAlign:"left"},children:"Basic Mode"}),(0,i.jsx)(s.th,{style:{textAlign:"left"},children:"Configuration Mode"}),(0,i.jsx)(s.th,{style:{textAlign:"left"},children:"Studio Mode"}),(0,i.jsx)(s.th,{style:{textAlign:"left"},children:"Admin Mode"})]})}),(0,i.jsxs)(s.tbody,{children:[(0,i.jsxs)(s.tr,{children:[(0,i.jsx)(s.td,{style:{textAlign:"left"},children:(0,i.jsx)(s.strong,{children:"Rundowns"})}),(0,i.jsx)(s.td,{style:{textAlign:"left"},children:"View Only"}),(0,i.jsx)(s.td,{style:{textAlign:"left"},children:"View Only"}),(0,i.jsx)(s.td,{style:{textAlign:"left"},children:"Yes, playout"}),(0,i.jsx)(s.td,{style:{textAlign:"left"},children:"Yes, playout"})]}),(0,i.jsxs)(s.tr,{children:[(0,i.jsx)(s.td,{style:{textAlign:"left"},children:(0,i.jsx)(s.strong,{children:"Settings"})}),(0,i.jsx)(s.td,{style:{textAlign:"left"},children:"No"}),(0,i.jsx)(s.td,{style:{textAlign:"left"},children:"Yes"}),(0,i.jsx)(s.td,{style:{textAlign:"left"},children:"No"}),(0,i.jsx)(s.td,{style:{textAlign:"left"},children:"Yes"})]})]})]}),"\n",(0,i.jsx)(s.h3,{id:"basic-mode",children:"Basic mode"}),"\n",(0,i.jsx)(s.p,{children:"Without enabling any additional modes in Sofie, the browser will have minimal access to the system. It will be able to view a rundown but, will not have the ability to manipulate it. This includes activating, deactivating, or resetting the rundown as well as taking the next part, adlib, etc."}),"\n",(0,i.jsx)(s.h3,{id:"studio-mode",children:"Studio mode"}),"\n",(0,i.jsxs)(s.p,{children:["Studio Mode gives the current browser full control of the studio and all information associated to it. This includes allowing actions like activating and deactivating rundowns, taking parts, adlibbing, etc. This mode is accessed by adding a ",(0,i.jsx)(s.code,{children:"?studio=1"})," to the end of the URL."]}),"\n",(0,i.jsx)(s.h3,{id:"configuration-mode",children:"Configuration mode"}),"\n",(0,i.jsxs)(s.p,{children:["Configuration mode gives the user full control over the Settings pages and allows full access to the system including the ability to modify ",(0,i.jsx)(s.em,{children:"Blueprints"}),", ",(0,i.jsx)(s.em,{children:"Studios"}),", or ",(0,i.jsx)(s.em,{children:"Show Styles"}),", creating and restoring ",(0,i.jsx)(s.em,{children:"Snapshots"}),", as well as modifying attached devices."]}),"\n",(0,i.jsx)(s.h3,{id:"help-mode",children:"Help Mode"}),"\n",(0,i.jsxs)(s.p,{children:["Enables some tooltips that might be useful to new users. This mode is accessed by adding ",(0,i.jsx)(s.code,{children:"?help=1"})," to the end of the URL."]}),"\n",(0,i.jsx)(s.h3,{id:"admin-mode",children:"Admin Mode"}),"\n",(0,i.jsxs)(s.p,{children:["This mode will give the user the same access as the ",(0,i.jsx)(s.em,{children:"Configuration"})," and ",(0,i.jsx)(s.em,{children:"Studio"})," modes as well as having access to a set of ",(0,i.jsx)(s.em,{children:"Test Tools"})," and a ",(0,i.jsx)(s.em,{children:"Manual Control"})," section on the Rundown page."]}),"\n",(0,i.jsxs)(s.p,{children:["This mode is enabled when ",(0,i.jsx)(s.code,{children:"?admin=1"})," is added the end of the URL."]}),"\n",(0,i.jsx)(s.h3,{id:"testing-mode",children:"Testing Mode"}),"\n",(0,i.jsxs)(s.p,{children:["Enables the page Test Tools, which contains various tools useful for testing the system during development. This mode is enabled when ",(0,i.jsx)(s.code,{children:"?testing=1"})," is added the end of the URL."]}),"\n",(0,i.jsx)(s.h3,{id:"developer-mode",children:"Developer Mode"}),"\n",(0,i.jsxs)(s.p,{children:["This mode will enable the browsers default right click menu to appear and can be accessed by adding ",(0,i.jsx)(s.code,{children:"?develop=1"})," to the URL. It will also reveal the Manual Control section on the Rundown page."]})]})}function h(e={}){const{wrapper:s}={...(0,n.R)(),...e.components};return s?(0,i.jsx)(s,{...e,children:(0,i.jsx)(c,{...e})}):c(e)}},43023:(e,s,t)=>{t.d(s,{R:()=>l,x:()=>d});var i=t(63696);const n={},o=i.createContext(n);function l(e){const s=i.useContext(o);return i.useMemo((function(){return"function"==typeof e?e(s):{...s,...e}}),[s,e])}function d(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(n):e.components||n:l(e.components),i.createElement(o.Provider,{value:s},e.children)}}}]);