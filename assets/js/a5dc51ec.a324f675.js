"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[7669],{5318:(e,t,n)=>{n.d(t,{Zo:()=>u,kt:()=>p});var a=n(7378);function r(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function o(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?o(Object(n),!0).forEach((function(t){r(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):o(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,a,r=function(e,t){if(null==e)return{};var n,a,r={},o=Object.keys(e);for(a=0;a<o.length;a++)n=o[a],t.indexOf(n)>=0||(r[n]=e[n]);return r}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(a=0;a<o.length;a++)n=o[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(r[n]=e[n])}return r}var l=a.createContext({}),c=function(e){var t=a.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},u=function(e){var t=c(e.components);return a.createElement(l.Provider,{value:t},e.children)},w={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},d=a.forwardRef((function(e,t){var n=e.components,r=e.mdxType,o=e.originalType,l=e.parentName,u=s(e,["components","mdxType","originalType","parentName"]),d=c(n),p=r,y=d["".concat(l,".").concat(p)]||d[p]||w[p]||o;return n?a.createElement(y,i(i({ref:t},u),{},{components:n})):a.createElement(y,i({ref:t},u))}));function p(e,t){var n=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var o=n.length,i=new Array(o);i[0]=d;var s={};for(var l in t)hasOwnProperty.call(t,l)&&(s[l]=t[l]);s.originalType=e,s.mdxType="string"==typeof e?e:r,i[1]=s;for(var c=2;c<o;c++)i[c]=n[c];return a.createElement.apply(null,i)}return a.createElement.apply(null,n)}d.displayName="MDXCreateElement"},9351:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>i,default:()=>w,frontMatter:()=>o,metadata:()=>s,toc:()=>c});var a=n(5773),r=(n(7378),n(5318));const o={},i="iNEWS Gateway",s={unversionedId:"user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/inews-gateway",id:"version-1.46.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/inews-gateway",title:"iNEWS Gateway",description:"The iNEWS Gateway communicates with an iNEWS system to ingest and remain in sync with a rundown.",source:"@site/versioned_docs/version-1.46.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/inews-gateway.md",sourceDirName:"user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection",slug:"/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/inews-gateway",permalink:"/sofie-core/docs/1.46.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/inews-gateway",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.46.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/inews-gateway.md",tags:[],version:"1.46.0",frontMatter:{},sidebar:"version-1.45.0/userGuide",previous:{title:"Playout Gateway",permalink:"/sofie-core/docs/1.46.0/user-guide/installation/installing-a-gateway/playout-gateway"},next:{title:"Google Spreadsheet Gateway",permalink:"/sofie-core/docs/1.46.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support"}},l={},c=[{value:"Installing iNEWS for Sofie",id:"installing-inews-for-sofie",level:3}],u={toc:c};function w(e){let{components:t,...n}=e;return(0,r.kt)("wrapper",(0,a.Z)({},u,n,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"inews-gateway"},"iNEWS Gateway"),(0,r.kt)("p",null,"The iNEWS Gateway communicates with an iNEWS system to ingest and remain in sync with a rundown."),(0,r.kt)("h3",{id:"installing-inews-for-sofie"},"Installing iNEWS for Sofie"),(0,r.kt)("p",null,"The iNEWS Gateway allows you to create rundowns from within iNEWS and sync them with the ",(0,r.kt)("em",{parentName:"p"},"Sofie","\xa0","Core"),". The rundowns will update in real time and any changes made will be seen from within your Playout Timeline. "),(0,r.kt)("p",null,"The setup for the iNEWS Gateway is already in the Docker Compose file you downloaded earlier. Remove the ",(0,r.kt)("em",{parentName:"p"},"#")," symbol from the start of the line labeled ",(0,r.kt)("inlineCode",{parentName:"p"},"image: tv2/inews-ftp-gateway:develop")," and add a ",(0,r.kt)("em",{parentName:"p"},"#")," to the other ingest gateway that was being used."),(0,r.kt)("p",null,"Although the iNEWS Gateway is available free of charge, an iNEWS license is not. Visit ",(0,r.kt)("a",{parentName:"p",href:"https://www.avid.com/products/inews/how-to-buy"},"Avid's website")," to find an iNEWS reseller that handles your geographic area."))}w.isMDXComponent=!0}}]);