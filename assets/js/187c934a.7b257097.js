"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[8753],{5318:(e,t,n)=>{n.d(t,{Zo:()=>p,kt:()=>g});var r=n(7378);function i(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function a(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function o(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?a(Object(n),!0).forEach((function(t){i(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):a(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,r,i=function(e,t){if(null==e)return{};var n,r,i={},a=Object.keys(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)>=0||(i[n]=e[n]);return i}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(i[n]=e[n])}return i}var l=r.createContext({}),u=function(e){var t=r.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):o(o({},t),e)),n},p=function(e){var t=u(e.components);return r.createElement(l.Provider,{value:t},e.children)},c="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},f=r.forwardRef((function(e,t){var n=e.components,i=e.mdxType,a=e.originalType,l=e.parentName,p=s(e,["components","mdxType","originalType","parentName"]),c=u(n),f=i,g=c["".concat(l,".").concat(f)]||c[f]||d[f]||a;return n?r.createElement(g,o(o({ref:t},p),{},{components:n})):r.createElement(g,o({ref:t},p))}));function g(e,t){var n=arguments,i=t&&t.mdxType;if("string"==typeof e||i){var a=n.length,o=new Array(a);o[0]=f;var s={};for(var l in t)hasOwnProperty.call(t,l)&&(s[l]=t[l]);s.originalType=e,s[c]="string"==typeof e?e:i,o[1]=s;for(var u=2;u<a;u++)o[u]=n[u];return r.createElement.apply(null,o)}return r.createElement.apply(null,n)}f.displayName="MDXCreateElement"},4047:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>o,default:()=>d,frontMatter:()=>a,metadata:()=>s,toc:()=>u});var r=n(5773),i=(n(7378),n(5318));const a={sidebar_position:3},o="Initial Sofie Core Setup",s={unversionedId:"user-guide/installation/initial-sofie-core-setup",id:"version-1.38.0/user-guide/installation/initial-sofie-core-setup",title:"Initial Sofie Core Setup",description:"Prerequisites",source:"@site/versioned_docs/version-1.38.0/user-guide/installation/initial-sofie-core-setup.md",sourceDirName:"user-guide/installation",slug:"/user-guide/installation/initial-sofie-core-setup",permalink:"/sofie-core/docs/1.38.0/user-guide/installation/initial-sofie-core-setup",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.38.0/user-guide/installation/initial-sofie-core-setup.md",tags:[],version:"1.38.0",sidebarPosition:3,frontMatter:{sidebar_position:3},sidebar:"version-1.38.0/userGuide",previous:{title:"Quick install",permalink:"/sofie-core/docs/1.38.0/user-guide/installation/installing-sofie-server-core"},next:{title:"Installing Blueprints",permalink:"/sofie-core/docs/1.38.0/user-guide/installation/installing-blueprints"}},l={},u=[{value:"Prerequisites",id:"prerequisites",level:4}],p={toc:u},c="wrapper";function d(e){let{components:t,...a}=e;return(0,i.kt)(c,(0,r.Z)({},p,a,{components:t,mdxType:"MDXLayout"}),(0,i.kt)("h1",{id:"initial-sofie-core-setup"},"Initial Sofie Core Setup"),(0,i.kt)("h4",{id:"prerequisites"},"Prerequisites"),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("a",{parentName:"li",href:"installing-sofie-server-core"},"Installed and running ",(0,i.kt)("em",{parentName:"a"},"Sofie","\xa0","Core")))),(0,i.kt)("p",null,"Once ",(0,i.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," has been installed and is running you can begin setting it up. The first step is to navigate to the ",(0,i.kt)("em",{parentName:"p"},"Settings page"),". Please review the ",(0,i.kt)("a",{parentName:"p",href:"../features/access-levels"},"Sofie Access Level")," page for assistance getting there."),(0,i.kt)("p",null,'To upgrade to a newer version or installation of new blueprints, Sofie needs to run its "Upgrade database" procedure to migrate data and pre-fill various settings. You can do this by clicking the ',(0,i.kt)("em",{parentName:"p"},"Upgrade Database")," button in the menu. "),(0,i.kt)("p",null,(0,i.kt)("img",{alt:"Update Database Section of the Settings Page",src:n(3674).Z,width:"1260",height:"700"})),(0,i.kt)("p",null,"Fill in the form as prompted and continue by clicking ",(0,i.kt)("em",{parentName:"p"},"Run Migrations Procedure"),". Sometimes you will need to go through multiple steps before the upgrade is finished."),(0,i.kt)("p",null,"Next, you will need to add some ",(0,i.kt)("a",{parentName:"p",href:"installing-blueprints"},"Blueprints")," and add ",(0,i.kt)("a",{parentName:"p",href:"installing-a-gateway/intro"},"Gateways")," to allow ",(0,i.kt)("em",{parentName:"p"},"Sofie")," to interpret rundown data and then play out things."))}d.isMDXComponent=!0},3674:(e,t,n)=>{n.d(t,{Z:()=>r});const r=n.p+"assets/images/settings-page-full-update-db-bc1c535921f6f178717eef9a415d4e6f.jpg"}}]);