"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[9389],{5318:function(e,n,t){t.d(n,{Zo:function(){return l},kt:function(){return d}});var o=t(7378);function r(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function a(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);n&&(o=o.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,o)}return t}function i(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?a(Object(t),!0).forEach((function(n){r(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):a(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function s(e,n){if(null==e)return{};var t,o,r=function(e,n){if(null==e)return{};var t,o,r={},a=Object.keys(e);for(o=0;o<a.length;o++)t=a[o],n.indexOf(t)>=0||(r[t]=e[t]);return r}(e,n);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(o=0;o<a.length;o++)t=a[o],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(r[t]=e[t])}return r}var c=o.createContext({}),u=function(e){var n=o.useContext(c),t=n;return e&&(t="function"==typeof e?e(n):i(i({},n),e)),t},l=function(e){var n=u(e.components);return o.createElement(c.Provider,{value:n},e.children)},m={inlineCode:"code",wrapper:function(e){var n=e.children;return o.createElement(o.Fragment,{},n)}},p=o.forwardRef((function(e,n){var t=e.components,r=e.mdxType,a=e.originalType,c=e.parentName,l=s(e,["components","mdxType","originalType","parentName"]),p=u(t),d=r,y=p["".concat(c,".").concat(d)]||p[d]||m[d]||a;return t?o.createElement(y,i(i({ref:n},l),{},{components:t})):o.createElement(y,i({ref:n},l))}));function d(e,n){var t=arguments,r=n&&n.mdxType;if("string"==typeof e||r){var a=t.length,i=new Array(a);i[0]=p;var s={};for(var c in n)hasOwnProperty.call(n,c)&&(s[c]=n[c]);s.originalType=e,s.mdxType="string"==typeof e?e:r,i[1]=s;for(var u=2;u<a;u++)i[u]=t[u];return o.createElement.apply(null,i)}return o.createElement.apply(null,t)}p.displayName="MDXCreateElement"},1724:function(e,n,t){t.r(n),t.d(n,{frontMatter:function(){return s},contentTitle:function(){return c},metadata:function(){return u},toc:function(){return l},default:function(){return p}});var o=t(5773),r=t(808),a=(t(7378),t(5318)),i=["components"],s={},c="MOS Gateway",u={unversionedId:"user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/mos-gateway",id:"version-1.38.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/mos-gateway",isDocsHomePage:!1,title:"MOS Gateway",description:"The MOS Gateway communicates with a device that supports the MOS protocol to ingest and remain in sync with a rundown. It can connect to any editorial system \\(NRCS\\) that uses version 2.8.4 of the MOS protocol, such as ENPS, and sync their rundowns with the Sofie&nbsp;Core. The rundowns are kept updated in real time and any changes made will be seen in the Sofie GUI.",source:"@site/versioned_docs/version-1.38.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/mos-gateway.md",sourceDirName:"user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection",slug:"/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/mos-gateway",permalink:"/sofie-core/docs/1.38.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/mos-gateway",editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.38.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/mos-gateway.md",tags:[],version:"1.38.0",frontMatter:{},sidebar:"version-1.38.0/userGuide",previous:{title:"Rundown & Newsroom Systems",permalink:"/sofie-core/docs/1.38.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/intro"},next:{title:"Additional Software & Hardware",permalink:"/sofie-core/docs/1.38.0/user-guide/installation/installing-connections-and-additional-hardware/README"}},l=[],m={toc:l};function p(e){var n=e.components,t=(0,r.Z)(e,i);return(0,a.kt)("wrapper",(0,o.Z)({},m,t,{components:n,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"mos-gateway"},"MOS Gateway"),(0,a.kt)("p",null,"The MOS Gateway communicates with a device that supports the ",(0,a.kt)("a",{parentName:"p",href:"http://mosprotocol.com/wp-content/MOS-Protocol-Documents/MOS-Protocol-2.8.4-Current.htm"},"MOS protocol")," to ingest and remain in sync with a rundown. It can connect to any editorial system ","(","NRCS",")"," that uses version 2.8.4 of the MOS protocol, such as ENPS, and sync their rundowns with the ",(0,a.kt)("em",{parentName:"p"},"Sofie","\xa0","Core"),". The rundowns are kept updated in real time and any changes made will be seen in the Sofie GUI."),(0,a.kt)("p",null,"The setup for the MOS Gateway is handled in the Docker Compose in the ",(0,a.kt)("a",{parentName:"p",href:"../../installing-sofie-server-core"},"Quick Install")," page."),(0,a.kt)("p",null,"One thing to note if managing the mos-gateway manually: It needs a few ports open ","(","10540, 10541",")"," for MOS-messages to be pushed to it from the NCS."))}p.isMDXComponent=!0}}]);