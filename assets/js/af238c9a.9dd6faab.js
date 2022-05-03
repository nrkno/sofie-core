"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[7167],{5318:function(e,t,n){n.d(t,{Zo:function(){return c},kt:function(){return m}});var a=n(7378);function r(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function o(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?o(Object(n),!0).forEach((function(t){r(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):o(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function l(e,t){if(null==e)return{};var n,a,r=function(e,t){if(null==e)return{};var n,a,r={},o=Object.keys(e);for(a=0;a<o.length;a++)n=o[a],t.indexOf(n)>=0||(r[n]=e[n]);return r}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(a=0;a<o.length;a++)n=o[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(r[n]=e[n])}return r}var s=a.createContext({}),u=function(e){var t=a.useContext(s),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},c=function(e){var t=u(e.components);return a.createElement(s.Provider,{value:t},e.children)},p={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},d=a.forwardRef((function(e,t){var n=e.components,r=e.mdxType,o=e.originalType,s=e.parentName,c=l(e,["components","mdxType","originalType","parentName"]),d=u(n),m=r,y=d["".concat(s,".").concat(m)]||d[m]||p[m]||o;return n?a.createElement(y,i(i({ref:t},c),{},{components:n})):a.createElement(y,i({ref:t},c))}));function m(e,t){var n=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var o=n.length,i=new Array(o);i[0]=d;var l={};for(var s in t)hasOwnProperty.call(t,s)&&(l[s]=t[s]);l.originalType=e,l.mdxType="string"==typeof e?e:r,i[1]=l;for(var u=2;u<o;u++)i[u]=n[u];return a.createElement.apply(null,i)}return a.createElement.apply(null,n)}d.displayName="MDXCreateElement"},8149:function(e,t,n){n.r(t),n.d(t,{frontMatter:function(){return l},contentTitle:function(){return s},metadata:function(){return u},toc:function(){return c},default:function(){return d}});var a=n(5773),r=n(808),o=(n(7378),n(5318)),i=["components"],l={sidebar_label:"Introduction",sidebar_position:1},s="Introduction: Installing a Gateway",u={unversionedId:"user-guide/installation/installing-a-gateway/intro",id:"version-1.38.0/user-guide/installation/installing-a-gateway/intro",isDocsHomePage:!1,title:"Introduction: Installing a Gateway",description:"Prerequisites",source:"@site/versioned_docs/version-1.38.0/user-guide/installation/installing-a-gateway/intro.md",sourceDirName:"user-guide/installation/installing-a-gateway",slug:"/user-guide/installation/installing-a-gateway/intro",permalink:"/sofie-core/docs/1.38.0/user-guide/installation/installing-a-gateway/intro",editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.38.0/user-guide/installation/installing-a-gateway/intro.md",tags:[],version:"1.38.0",sidebarPosition:1,frontMatter:{sidebar_label:"Introduction",sidebar_position:1},sidebar:"version-1.38.0/userGuide",previous:{title:"Installing Blueprints",permalink:"/sofie-core/docs/1.38.0/user-guide/installation/installing-blueprints"},next:{title:"Playout Gateway",permalink:"/sofie-core/docs/1.38.0/user-guide/installation/installing-a-gateway/playout-gateway"}},c=[{value:"Prerequisites",id:"prerequisites",children:[],level:4},{value:"Rundown &amp; Newsroom Gateways",id:"rundown--newsroom-gateways",children:[],level:3},{value:"Playout &amp; Media Manager Gateways",id:"playout--media-manager-gateways",children:[],level:3}],p={toc:c};function d(e){var t=e.components,n=(0,r.Z)(e,i);return(0,o.kt)("wrapper",(0,a.Z)({},p,n,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"introduction-installing-a-gateway"},"Introduction: Installing a Gateway"),(0,o.kt)("h4",{id:"prerequisites"},"Prerequisites"),(0,o.kt)("ul",null,(0,o.kt)("li",{parentName:"ul"},(0,o.kt)("a",{parentName:"li",href:"../installing-sofie-server-core"},"Installed and running Sofie","\xa0","Core"))),(0,o.kt)("p",null,"The ",(0,o.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," is the primary application for managing the broadcast, but it doesn't play anything out on it's own. A Gateway will establish the connection from ",(0,o.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," to other pieces of hardware or remote software. A basic setup may include the ",(0,o.kt)("a",{parentName:"p",href:"rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support"},"Spreadsheet Gateway")," which will ingest a rundown from Google Sheets then, use the ",(0,o.kt)("a",{parentName:"p",href:"playout-gateway"},"Playout Gateway")," send commands to a CasparCG","\xa0","Server graphics playout, an ATEM vision mixer, and / or the ",(0,o.kt)("a",{parentName:"p",href:"https://github.com/olzzon/sisyfos-audio-controller"},"Sisyfos audio controller"),"."),(0,o.kt)("p",null,"Installing a gateway is a two part process. To begin, you will ",(0,o.kt)("a",{parentName:"p",href:"../installing-blueprints"},"add the required Blueprints"),", or mini plug-in programs, to ",(0,o.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," so it can manipulate the data from the Gateway. Then you will install the Gateway itself. Each Gateway follows a similar installation pattern but, each one does differ slightly. The links below will help you navigate to the correct Gateway for the piece of hardware / software you are using."),(0,o.kt)("h3",{id:"rundown--newsroom-gateways"},"Rundown & Newsroom Gateways"),(0,o.kt)("ul",null,(0,o.kt)("li",{parentName:"ul"},(0,o.kt)("a",{parentName:"li",href:"rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support"},"Google Spreadsheet Gateway")),(0,o.kt)("li",{parentName:"ul"},(0,o.kt)("a",{parentName:"li",href:"rundown-or-newsroom-system-connection/inews-gateway"},"iNEWS Gateway")),(0,o.kt)("li",{parentName:"ul"},(0,o.kt)("a",{parentName:"li",href:"rundown-or-newsroom-system-connection/mos-gateway"},"MOS Gateway"))),(0,o.kt)("h3",{id:"playout--media-manager-gateways"},"Playout & Media Manager Gateways"),(0,o.kt)("ul",null,(0,o.kt)("li",{parentName:"ul"},(0,o.kt)("a",{parentName:"li",href:"playout-gateway"},"Playout Gateway")),(0,o.kt)("li",{parentName:"ul"},(0,o.kt)("a",{parentName:"li",href:"../media-manager"},"Media Manager"))))}d.isMDXComponent=!0}}]);