"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[8114],{5318:(e,t,n)=>{n.d(t,{Zo:()=>p,kt:()=>m});var i=n(7378);function r(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function l(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);t&&(i=i.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,i)}return n}function a(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?l(Object(n),!0).forEach((function(t){r(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):l(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function o(e,t){if(null==e)return{};var n,i,r=function(e,t){if(null==e)return{};var n,i,r={},l=Object.keys(e);for(i=0;i<l.length;i++)n=l[i],t.indexOf(n)>=0||(r[n]=e[n]);return r}(e,t);if(Object.getOwnPropertySymbols){var l=Object.getOwnPropertySymbols(e);for(i=0;i<l.length;i++)n=l[i],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(r[n]=e[n])}return r}var s=i.createContext({}),u=function(e){var t=i.useContext(s),n=t;return e&&(n="function"==typeof e?e(t):a(a({},t),e)),n},p=function(e){var t=u(e.components);return i.createElement(s.Provider,{value:t},e.children)},d={inlineCode:"code",wrapper:function(e){var t=e.children;return i.createElement(i.Fragment,{},t)}},c=i.forwardRef((function(e,t){var n=e.components,r=e.mdxType,l=e.originalType,s=e.parentName,p=o(e,["components","mdxType","originalType","parentName"]),c=u(n),m=r,h=c["".concat(s,".").concat(m)]||c[m]||d[m]||l;return n?i.createElement(h,a(a({ref:t},p),{},{components:n})):i.createElement(h,a({ref:t},p))}));function m(e,t){var n=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var l=n.length,a=new Array(l);a[0]=c;var o={};for(var s in t)hasOwnProperty.call(t,s)&&(o[s]=t[s]);o.originalType=e,o.mdxType="string"==typeof e?e:r,a[1]=o;for(var u=2;u<l;u++)a[u]=n[u];return i.createElement.apply(null,a)}return i.createElement.apply(null,n)}c.displayName="MDXCreateElement"},2229:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>s,contentTitle:()=>a,default:()=>d,frontMatter:()=>l,metadata:()=>o,toc:()=>u});var i=n(5773),r=(n(7378),n(5318));const l={sidebar_position:4},a="Installing Blueprints",o={unversionedId:"user-guide/installation/installing-blueprints",id:"version-1.37.0/user-guide/installation/installing-blueprints",title:"Installing Blueprints",description:"Prerequisites",source:"@site/versioned_docs/version-1.37.0/user-guide/installation/installing-blueprints.md",sourceDirName:"user-guide/installation",slug:"/user-guide/installation/installing-blueprints",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/installing-blueprints",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.37.0/user-guide/installation/installing-blueprints.md",tags:[],version:"1.37.0",sidebarPosition:4,frontMatter:{sidebar_position:4},sidebar:"version-1.37.0/gettingStarted",previous:{title:"Initial Sofie Core Setup",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/initial-sofie-core-setup"},next:{title:"Introduction",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/installing-a-gateway/intro"}},s={},u=[{value:"Prerequisites",id:"prerequisites",level:4},{value:"System Blueprint",id:"system-blueprint",level:3},{value:"Studio Blueprint",id:"studio-blueprint",level:3},{value:"Show Style Blueprint",id:"show-style-blueprint",level:3},{value:"Further Reading",id:"further-reading",level:3}],p={toc:u};function d(e){let{components:t,...l}=e;return(0,r.kt)("wrapper",(0,i.Z)({},p,l,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"installing-blueprints"},"Installing Blueprints"),(0,r.kt)("h4",{id:"prerequisites"},"Prerequisites"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"installing-sofie-server-core"},"Installed and running Sofie","\xa0","Core")),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"initial-sofie-core-setup"},"Initial Sofie","\xa0","Core Setup"))),(0,r.kt)("p",null,"Blueprints are little plug-in programs that runs inside ",(0,r.kt)("em",{parentName:"p"},"Sofie"),". They are the logic that determines how ",(0,r.kt)("em",{parentName:"p"},"Sofie")," interacts with rundowns, hardware, and media."),(0,r.kt)("p",null,"Blueprints are custom scripts that you create yourself ","(","or download an existing one",")",". There are a set of example Blueprints for the Spreadsheet Gateway available for use here: ",(0,r.kt)("a",{parentName:"p",href:"https://github.com/SuperFlyTV/sofie-demo-blueprints"},"https://github.com/SuperFlyTV/sofie-demo-blueprints"),"."),(0,r.kt)("p",null,"To begin installing any Blueprint, navigate to the ",(0,r.kt)("em",{parentName:"p"},"Settings page"),". Getting there is covered in the ",(0,r.kt)("a",{parentName:"p",href:"../features/access-levels"},"Access Levels")," page."),(0,r.kt)("p",null,(0,r.kt)("img",{alt:"The Settings Page",src:n(6956).Z,width:"879",height:"363"})),(0,r.kt)("p",null,"To upload a new blueprint, click the ",(0,r.kt)("em",{parentName:"p"},"+")," icon next to Blueprints menu option. Select the newly created Blueprint and upload the local blueprint JS file. You will get a confirmation if the installation was successful."),(0,r.kt)("p",null,"There are 3 types of blueprints: System, Studio and Show Style:"),(0,r.kt)("h3",{id:"system-blueprint"},"System Blueprint"),(0,r.kt)("p",null,(0,r.kt)("em",{parentName:"p"},"System Blueprints handles some basic functionality on how the Sofie system will operate.")),(0,r.kt)("p",null,"After you've uploaded the your system-blueprint js-file, click ",(0,r.kt)("em",{parentName:"p"},"Assign")," in the blueprint-page to assign it as system-blueprint."),(0,r.kt)("h3",{id:"studio-blueprint"},"Studio Blueprint"),(0,r.kt)("p",null,(0,r.kt)("em",{parentName:"p"},"Studio Blueprints determine how Sofie will interact with the hardware in your studio.")),(0,r.kt)("p",null,"After you've uploaded the your studio-blueprint js-file, navigate to a Studio in the settings and assign the new Blueprint to it ","(","under the label ",(0,r.kt)("em",{parentName:"p"},"Blueprint")," ",")","."),(0,r.kt)("p",null,"After having installed the Blueprint, the Studio's baseline will need to be reloaded. On the Studio page, click the button ",(0,r.kt)("em",{parentName:"p"},"Reload Baseline"),". This will also be needed whenever you have changed any settings."),(0,r.kt)("h3",{id:"show-style-blueprint"},"Show Style Blueprint"),(0,r.kt)("p",null,(0,r.kt)("em",{parentName:"p"},"Show Style Blueprints determine how your show will look / feel.")),(0,r.kt)("p",null,"After you've uploaded the your show-style-blueprint js-file, navigate to a Show Style in the settings and assign the new Blueprint to it ","(","under the label ",(0,r.kt)("em",{parentName:"p"},"Blueprint")," ",")","."),(0,r.kt)("h3",{id:"further-reading"},"Further Reading"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"https://github.com/SuperFlyTV/sofie-demo-blueprints"},"Blueprints Supporting the Spreadsheet Gateway"))))}d.isMDXComponent=!0},6956:(e,t,n)=>{n.d(t,{Z:()=>i});const i=n.p+"assets/images/settings-page-33137c9de738f375484e364b4c0ad1af.jpg"}}]);