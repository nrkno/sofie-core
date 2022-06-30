"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[8900],{5318:function(e,t,r){r.d(t,{Zo:function(){return p},kt:function(){return d}});var n=r(7378);function o(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function a(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function i(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?a(Object(r),!0).forEach((function(t){o(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):a(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function u(e,t){if(null==e)return{};var r,n,o=function(e,t){if(null==e)return{};var r,n,o={},a=Object.keys(e);for(n=0;n<a.length;n++)r=a[n],t.indexOf(r)>=0||(o[r]=e[r]);return o}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(n=0;n<a.length;n++)r=a[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(o[r]=e[r])}return o}var c=n.createContext({}),s=function(e){var t=n.useContext(c),r=t;return e&&(r="function"==typeof e?e(t):i(i({},t),e)),r},p=function(e){var t=s(e.components);return n.createElement(c.Provider,{value:t},e.children)},l={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},f=n.forwardRef((function(e,t){var r=e.components,o=e.mdxType,a=e.originalType,c=e.parentName,p=u(e,["components","mdxType","originalType","parentName"]),f=s(r),d=o,m=f["".concat(c,".").concat(d)]||f[d]||l[d]||a;return r?n.createElement(m,i(i({ref:t},p),{},{components:r})):n.createElement(m,i({ref:t},p))}));function d(e,t){var r=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var a=r.length,i=new Array(a);i[0]=f;var u={};for(var c in t)hasOwnProperty.call(t,c)&&(u[c]=t[c]);u.originalType=e,u.mdxType="string"==typeof e?e:o,i[1]=u;for(var s=2;s<a;s++)i[s]=r[s];return n.createElement.apply(null,i)}return n.createElement.apply(null,r)}f.displayName="MDXCreateElement"},444:function(e,t,r){r.r(t),r.d(t,{assets:function(){return p},contentTitle:function(){return c},default:function(){return d},frontMatter:function(){return u},metadata:function(){return s},toc:function(){return l}});var n=r(5773),o=r(808),a=(r(7378),r(5318)),i=["components"],u={},c="API",s={unversionedId:"user-guide/features/api",id:"version-1.41.0/user-guide/features/api",title:"API",description:"REST API",source:"@site/versioned_docs/version-1.41.0/user-guide/features/api.md",sourceDirName:"user-guide/features",slug:"/user-guide/features/api",permalink:"/sofie-core/docs/1.41.0/user-guide/features/api",editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.41.0/user-guide/features/api.md",tags:[],version:"1.41.0",frontMatter:{},sidebar:"userGuide",previous:{title:"Language",permalink:"/sofie-core/docs/1.41.0/user-guide/features/language"},next:{title:"Getting Started",permalink:"/sofie-core/docs/1.41.0/user-guide/installation/intro"}},p={},l=[{value:"REST API",id:"rest-api",level:2},{value:"DDP \u2013 Core Integration",id:"ddp--core-integration",level:2}],f={toc:l};function d(e){var t=e.components,r=(0,o.Z)(e,i);return(0,a.kt)("wrapper",(0,n.Z)({},f,r,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"api"},"API"),(0,a.kt)("h2",{id:"rest-api"},"REST API"),(0,a.kt)("p",null,"There is a preliminary REST API available that can be used to fetch data and trigger actions."),(0,a.kt)("p",null,"The documentation is minimal at the moment, but the API endpoints are listed by ",(0,a.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," using the endpoint: ",(0,a.kt)("inlineCode",{parentName:"p"},"/api/0")),(0,a.kt)("h2",{id:"ddp--core-integration"},"DDP \u2013 Core Integration"),(0,a.kt)("p",null,"If you're planning to build NodeJS applications that talk to ",(0,a.kt)("em",{parentName:"p"},"Sofie","\xa0","Core"),", we recommend using the ",(0,a.kt)("a",{parentName:"p",href:"https://github.com/nrkno/sofie-core/tree/master/packages/server-core-integration"},"core-integration")," library, which exposes a number of callable methods and allows for subscribing to data the same way the ",(0,a.kt)("a",{parentName:"p",href:"../concepts-and-architecture#gateways"},"Gateways")," do it."))}d.isMDXComponent=!0}}]);