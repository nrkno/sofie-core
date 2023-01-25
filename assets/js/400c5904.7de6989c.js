"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[9009],{5318:function(e,t,n){n.d(t,{Zo:function(){return s},kt:function(){return m}});var r=n(7378);function o(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function a(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function l(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?a(Object(n),!0).forEach((function(t){o(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):a(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function u(e,t){if(null==e)return{};var n,r,o=function(e,t){if(null==e)return{};var n,r,o={},a=Object.keys(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)>=0||(o[n]=e[n]);return o}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(o[n]=e[n])}return o}var i=r.createContext({}),c=function(e){var t=r.useContext(i),n=t;return e&&(n="function"==typeof e?e(t):l(l({},t),e)),n},s=function(e){var t=c(e.components);return r.createElement(i.Provider,{value:t},e.children)},f={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},p=r.forwardRef((function(e,t){var n=e.components,o=e.mdxType,a=e.originalType,i=e.parentName,s=u(e,["components","mdxType","originalType","parentName"]),p=c(n),m=o,d=p["".concat(i,".").concat(m)]||p[m]||f[m]||a;return n?r.createElement(d,l(l({ref:t},s),{},{components:n})):r.createElement(d,l({ref:t},s))}));function m(e,t){var n=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var a=n.length,l=new Array(a);l[0]=p;var u={};for(var i in t)hasOwnProperty.call(t,i)&&(u[i]=t[i]);u.originalType=e,u.mdxType="string"==typeof e?e:o,l[1]=u;for(var c=2;c<a;c++)l[c]=n[c];return r.createElement.apply(null,l)}return r.createElement.apply(null,n)}p.displayName="MDXCreateElement"},4371:function(e,t,n){n.r(t),n.d(t,{assets:function(){return f},contentTitle:function(){return c},default:function(){return d},frontMatter:function(){return i},metadata:function(){return s},toc:function(){return p}});var r=n(5773),o=n(808),a=(n(7378),n(5318)),l=n(4863),u=["components"],i={title:"Releases",hide_table_of_contents:!0,slug:"/"},c=void 0,s={unversionedId:"releases",id:"releases",title:"Releases",description:"Current, future, and past releases of Sofie are all tracked on NRK's GitHub repository.",source:"@site/releases/releases.mdx",sourceDirName:".",slug:"/",permalink:"/sofie-core/releases/",draft:!1,tags:[],version:"current",frontMatter:{title:"Releases",hide_table_of_contents:!0,slug:"/"}},f={},p=[],m={toc:p};function d(e){var t=e.components,n=(0,o.Z)(e,u);return(0,a.kt)("wrapper",(0,r.Z)({},m,n,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("p",null,"Current, future, and past releases of ",(0,a.kt)("em",{parentName:"p"},"Sofie")," are all tracked on ",(0,a.kt)("a",{parentName:"p",href:"https://github.com/nrkno/Sofie-TV-automation/issues?utf8=%E2%9C%93&q=is%3Aissue+label%3ARelease"},(0,a.kt)("strong",{parentName:"a"},"NRK's GitHub repository")),"."),(0,a.kt)(l.Z,{org:"nrkno",repo:"Sofie-TV-Automation",releaseLabel:"Release",state:"all",mdxType:"GitHubReleases"}))}d.isMDXComponent=!0},4863:function(e,t,n){n.d(t,{Z:function(){return a}});var r=n(7378),o=n(8458);function a(e){var t=e.org,n=e.repo,a=e.releaseLabel,l=e.state,u=(0,r.useState)(0),i=u[0],c=u[1],s=(0,r.useState)([]),f=s[0],p=s[1];return(0,r.useEffect)((function(){var e=!0;return fetch("https://api.github.com/repos/"+t+"/"+n+"/issues?state="+(l||"open"),{headers:[["Accept","application/vnd.github.v3+json"]]}).then((function(e){if(e.ok)return e.json();throw new Error(e.status)})).then((function(t){e&&(p(t.filter((function(e){return e.labels.find((function(e){return e.name===a}))}))),c(1))})).catch((function(t){e&&(console.error(t),c(2))})),function(){e=!1}}),[a]),1!==i?null:r.createElement("table",null,r.createElement("thead",null,r.createElement("tr",null,r.createElement("th",{align:"left"},"Release"),r.createElement("th",{align:"left"},"Status"))),r.createElement("tbody",null,f.map((function(e){return r.createElement("tr",{key:e.id},r.createElement("td",null,r.createElement("a",{id:e.title.toLowerCase().replace(/\s+/,"-"),href:e.html_url},e.title,r.createElement(o.Z,null))),r.createElement("td",null,e.labels.filter((function(e){return e.name!==a})).map((function(e){return r.createElement("div",{key:e.node_id,className:"badge margin-right--xs",style:{backgroundColor:"#"+e.color}},e.name.replace(/^! /,""))}))))}))))}}}]);