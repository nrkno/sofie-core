"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[6265],{93736:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>r,default:()=>h,frontMatter:()=>s,metadata:()=>a,toc:()=>d});var i=n(62540),o=n(43023);const s={title:"API Stability",sidebar_position:11},r=void 0,a={id:"for-developers/api-stability",title:"API Stability",description:"Sofie has various APIs for talking between components, and for external systems to interact with.",source:"@site/versioned_docs/version-1.50.0/for-developers/api-stability.md",sourceDirName:"for-developers",slug:"/for-developers/api-stability",permalink:"/sofie-core/docs/1.50.0/for-developers/api-stability",draft:!1,unlisted:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.50.0/for-developers/api-stability.md",tags:[],version:"1.50.0",sidebarPosition:11,frontMatter:{title:"API Stability",sidebar_position:11},sidebar:"forDevelopers",previous:{title:"Worker Threads & Locks",permalink:"/sofie-core/docs/1.50.0/for-developers/worker-threads-and-locks"},next:{title:"Publications",permalink:"/sofie-core/docs/1.50.0/for-developers/publications"}},l={},d=[{value:"Stable",id:"stable",level:2},{value:"Internal",id:"internal",level:2}];function c(e){const t={a:"a",admonition:"admonition",code:"code",em:"em",h2:"h2",p:"p",...(0,o.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.p,{children:"Sofie has various APIs for talking between components, and for external systems to interact with."}),"\n",(0,i.jsx)(t.p,{children:"We classify each api into one of two categories:"}),"\n",(0,i.jsx)(t.h2,{id:"stable",children:"Stable"}),"\n",(0,i.jsx)(t.p,{children:"This is a collection of APIs which we intend to avoid introducing any breaking change to unless necessary. This is so external systems can rely on this API without needing to be updated in lockstep with Sofie, and hopefully will make sense to developers who are not familiar with Sofie's inner workings."}),"\n",(0,i.jsxs)(t.p,{children:["In version 1.50, a new REST API was introduced. This can be found at ",(0,i.jsx)(t.code,{children:"/api/v1.0"}),", and is designed to allow an external system to interact with Sofie using simplified abstractions of Sofie internals."]}),"\n",(0,i.jsxs)(t.p,{children:["The ",(0,i.jsx)(t.em,{children:"Live Status Gateway"})," is also part of this stable API, intended to allow for reactively retrieving data from Sofie. Internally it is translating the internal APIs into a stable version."]}),"\n",(0,i.jsx)(t.admonition,{type:"note",children:(0,i.jsxs)(t.p,{children:["You can find the ",(0,i.jsx)(t.em,{children:"Live Status Gateway"})," in the ",(0,i.jsx)(t.code,{children:"packages"})," folder of the ",(0,i.jsx)(t.a,{href:"https://github.com/nrkno/sofie-core",children:"Sofie Core"})," repository."]})}),"\n",(0,i.jsx)(t.h2,{id:"internal",children:"Internal"}),"\n",(0,i.jsxs)(t.p,{children:["This covers everything we expose over DDP, the ",(0,i.jsx)(t.code,{children:"/api/0"})," endpoint and any other http endpoints."]}),"\n",(0,i.jsxs)(t.p,{children:["These are intended for use between components of Sofie, which should be updated together. The DDP api does have breaking changes in most releases. We use the ",(0,i.jsx)(t.code,{children:"server-core-integration"})," library to manage these typings, and to ensure that compatible versions are used together."]})]})}function h(e={}){const{wrapper:t}={...(0,o.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(c,{...e})}):c(e)}},43023:(e,t,n)=>{n.d(t,{R:()=>r,x:()=>a});var i=n(63696);const o={},s=i.createContext(o);function r(e){const t=i.useContext(s);return i.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(o):e.components||o:r(e.components),i.createElement(s.Provider,{value:t},e.children)}}}]);