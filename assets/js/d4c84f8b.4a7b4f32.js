"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[3655],{5318:(e,t,a)=>{a.d(t,{Zo:()=>p,kt:()=>m});var n=a(7378);function r(e,t,a){return t in e?Object.defineProperty(e,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[t]=a,e}function o(e,t){var a=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),a.push.apply(a,n)}return a}function i(e){for(var t=1;t<arguments.length;t++){var a=null!=arguments[t]?arguments[t]:{};t%2?o(Object(a),!0).forEach((function(t){r(e,t,a[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(a)):o(Object(a)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(a,t))}))}return e}function l(e,t){if(null==e)return{};var a,n,r=function(e,t){if(null==e)return{};var a,n,r={},o=Object.keys(e);for(n=0;n<o.length;n++)a=o[n],t.indexOf(a)>=0||(r[a]=e[a]);return r}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(n=0;n<o.length;n++)a=o[n],t.indexOf(a)>=0||Object.prototype.propertyIsEnumerable.call(e,a)&&(r[a]=e[a])}return r}var s=n.createContext({}),u=function(e){var t=n.useContext(s),a=t;return e&&(a="function"==typeof e?e(t):i(i({},t),e)),a},p=function(e){var t=u(e.components);return n.createElement(s.Provider,{value:t},e.children)},c={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},d=n.forwardRef((function(e,t){var a=e.components,r=e.mdxType,o=e.originalType,s=e.parentName,p=l(e,["components","mdxType","originalType","parentName"]),d=u(a),m=r,y=d["".concat(s,".").concat(m)]||d[m]||c[m]||o;return a?n.createElement(y,i(i({ref:t},p),{},{components:a})):n.createElement(y,i({ref:t},p))}));function m(e,t){var a=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var o=a.length,i=new Array(o);i[0]=d;var l={};for(var s in t)hasOwnProperty.call(t,s)&&(l[s]=t[s]);l.originalType=e,l.mdxType="string"==typeof e?e:r,i[1]=l;for(var u=2;u<o;u++)i[u]=a[u];return n.createElement.apply(null,i)}return n.createElement.apply(null,a)}d.displayName="MDXCreateElement"},4602:(e,t,a)=>{a.r(t),a.d(t,{assets:()=>s,contentTitle:()=>i,default:()=>c,frontMatter:()=>o,metadata:()=>l,toc:()=>u});var n=a(5773),r=(a(7378),a(5318));const o={sidebar_label:"Introduction",sidebar_position:1},i="Introduction: Installing a Gateway",l={unversionedId:"user-guide/installation/installing-a-gateway/intro",id:"version-1.41.0/user-guide/installation/installing-a-gateway/intro",title:"Introduction: Installing a Gateway",description:"Prerequisites",source:"@site/versioned_docs/version-1.41.0/user-guide/installation/installing-a-gateway/intro.md",sourceDirName:"user-guide/installation/installing-a-gateway",slug:"/user-guide/installation/installing-a-gateway/intro",permalink:"/sofie-core/docs/1.41.0/user-guide/installation/installing-a-gateway/intro",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.41.0/user-guide/installation/installing-a-gateway/intro.md",tags:[],version:"1.41.0",sidebarPosition:1,frontMatter:{sidebar_label:"Introduction",sidebar_position:1},sidebar:"version-1.41.0/userGuide",previous:{title:"Installing Blueprints",permalink:"/sofie-core/docs/1.41.0/user-guide/installation/installing-blueprints"},next:{title:"Playout Gateway",permalink:"/sofie-core/docs/1.41.0/user-guide/installation/installing-a-gateway/playout-gateway"}},s={},u=[{value:"Prerequisites",id:"prerequisites",level:4},{value:"Rundown &amp; Newsroom Gateways",id:"rundown--newsroom-gateways",level:3},{value:"Playout &amp; Media Manager Gateways",id:"playout--media-manager-gateways",level:3}],p={toc:u};function c(e){let{components:t,...a}=e;return(0,r.kt)("wrapper",(0,n.Z)({},p,a,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"introduction-installing-a-gateway"},"Introduction: Installing a Gateway"),(0,r.kt)("h4",{id:"prerequisites"},"Prerequisites"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"../installing-sofie-server-core"},"Installed and running Sofie","\xa0","Core"))),(0,r.kt)("p",null,"The ",(0,r.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," is the primary application for managing the broadcast, but it doesn't play anything out on it's own. A Gateway will establish the connection from ",(0,r.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," to other pieces of hardware or remote software. A basic setup may include the ",(0,r.kt)("a",{parentName:"p",href:"rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support"},"Spreadsheet Gateway")," which will ingest a rundown from Google Sheets then, use the ",(0,r.kt)("a",{parentName:"p",href:"playout-gateway"},"Playout Gateway")," send commands to a CasparCG","\xa0","Server graphics playout, an ATEM vision mixer, and / or the ",(0,r.kt)("a",{parentName:"p",href:"https://github.com/olzzon/sisyfos-audio-controller"},"Sisyfos audio controller"),"."),(0,r.kt)("p",null,"Installing a gateway is a two part process. To begin, you will ",(0,r.kt)("a",{parentName:"p",href:"../installing-blueprints"},"add the required Blueprints"),", or mini plug-in programs, to ",(0,r.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," so it can manipulate the data from the Gateway. Then you will install the Gateway itself. Each Gateway follows a similar installation pattern but, each one does differ slightly. The links below will help you navigate to the correct Gateway for the piece of hardware / software you are using."),(0,r.kt)("h3",{id:"rundown--newsroom-gateways"},"Rundown & Newsroom Gateways"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support"},"Google Spreadsheet Gateway")),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"rundown-or-newsroom-system-connection/inews-gateway"},"iNEWS Gateway")),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"rundown-or-newsroom-system-connection/mos-gateway"},"MOS Gateway"))),(0,r.kt)("h3",{id:"playout--media-manager-gateways"},"Playout & Media Manager Gateways"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"playout-gateway"},"Playout Gateway")),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"../media-manager"},"Media Manager"))))}c.isMDXComponent=!0}}]);