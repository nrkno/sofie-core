"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[7610],{78887:(e,t,s)=>{s.r(t),s.d(t,{assets:()=>c,contentTitle:()=>l,default:()=>f,frontMatter:()=>a,metadata:()=>i,toc:()=>u});var n=s(62540),r=s(43023),o=s(19165);const a={title:"Releases",hide_table_of_contents:!0,slug:"/"},l=void 0,i={id:"releases",title:"Releases",description:"Current, future, and past releases of Sofie are all tracked on NRK's GitHub repository.",source:"@site/releases/releases.mdx",sourceDirName:".",slug:"/",permalink:"/sofie-core/releases/",draft:!1,unlisted:!1,tags:[],version:"current",frontMatter:{title:"Releases",hide_table_of_contents:!0,slug:"/"}},c={},u=[];function d(e){const t={a:"a",em:"em",p:"p",strong:"strong",...(0,r.R)(),...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsxs)(t.p,{children:["Current, future, and past releases of ",(0,n.jsx)(t.em,{children:"Sofie"})," are all tracked on ",(0,n.jsx)(t.a,{href:"https://github.com/nrkno/Sofie-TV-automation/issues?utf8=%E2%9C%93&q=is%3Aissue+label%3ARelease",children:(0,n.jsx)(t.strong,{children:"NRK's GitHub repository"})}),"."]}),"\n",(0,n.jsx)(o.A,{org:"nrkno",repo:"Sofie-TV-Automation",releaseLabel:"Release",state:"all"})]})}function f(e={}){const{wrapper:t}={...(0,r.R)(),...e.components};return t?(0,n.jsx)(t,{...e,children:(0,n.jsx)(d,{...e})}):d(e)}},19165:(e,t,s)=>{s.d(t,{A:()=>l});var n=s(63696),r=s(79016),o=s(62540);const a="https://api.github.com";function l(e){let{org:t,repo:s,releaseLabel:l,state:i}=e;const[c,u]=(0,n.useState)(0),[d,f]=(0,n.useState)([]);return(0,n.useEffect)((()=>{let e=!0;return fetch(`${a}/repos/${t}/${s}/issues?state=${i||"open"}`,{headers:[["Accept","application/vnd.github.v3+json"]]}).then((e=>{if(e.ok)return e.json();throw new Error(e.status)})).then((t=>{e&&(f(t.filter((e=>e.labels.find((e=>e.name===l))))),u(1))})).catch((t=>{e&&(console.error(t),u(2))})),()=>{e=!1}}),[l]),1!==c?null:(0,o.jsxs)("table",{children:[(0,o.jsx)("thead",{children:(0,o.jsxs)("tr",{children:[(0,o.jsx)("th",{align:"left",children:"Release"}),(0,o.jsx)("th",{align:"left",children:"Status"})]})}),(0,o.jsx)("tbody",{children:d.map((e=>(0,o.jsxs)("tr",{children:[(0,o.jsx)("td",{children:(0,o.jsxs)("a",{id:e.title.toLowerCase().replace(/\s+/,"-"),href:e.html_url,children:[e.title,(0,o.jsx)(r.A,{})]})}),(0,o.jsx)("td",{children:e.labels.filter((e=>e.name!==l)).map((e=>(0,o.jsx)("div",{className:"badge margin-right--xs",style:{backgroundColor:`#${e.color}`},children:e.name.replace(/^! /,"")},e.node_id)))})]},e.id)))})]})}},43023:(e,t,s)=>{s.d(t,{R:()=>a,x:()=>l});var n=s(63696);const r={},o=n.createContext(r);function a(e){const t=n.useContext(o);return n.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function l(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:a(e.components),n.createElement(o.Provider,{value:t},e.children)}}}]);