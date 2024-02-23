"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[9156],{5318:(e,t,n)=>{n.d(t,{Zo:()=>c,kt:()=>m});var r=n(7378);function o(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function i(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function a(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?i(Object(n),!0).forEach((function(t){o(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):i(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,r,o=function(e,t){if(null==e)return{};var n,r,o={},i=Object.keys(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||(o[n]=e[n]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(o[n]=e[n])}return o}var l=r.createContext({}),p=function(e){var t=r.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):a(a({},t),e)),n},c=function(e){var t=p(e.components);return r.createElement(l.Provider,{value:t},e.children)},u="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},f=r.forwardRef((function(e,t){var n=e.components,o=e.mdxType,i=e.originalType,l=e.parentName,c=s(e,["components","mdxType","originalType","parentName"]),u=p(n),f=o,m=u["".concat(l,".").concat(f)]||u[f]||d[f]||i;return n?r.createElement(m,a(a({ref:t},c),{},{components:n})):r.createElement(m,a({ref:t},c))}));function m(e,t){var n=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var i=n.length,a=new Array(i);a[0]=f;var s={};for(var l in t)hasOwnProperty.call(t,l)&&(s[l]=t[l]);s.originalType=e,s[u]="string"==typeof e?e:o,a[1]=s;for(var p=2;p<i;p++)a[p]=n[p];return r.createElement.apply(null,a)}return r.createElement.apply(null,n)}f.displayName="MDXCreateElement"},2820:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>a,default:()=>d,frontMatter:()=>i,metadata:()=>s,toc:()=>p});var r=n(5773),o=(n(7378),n(5318));const i={sidebar_position:1},a="Introduction",s={unversionedId:"for-developers/for-blueprint-developers/intro",id:"version-1.49.0/for-developers/for-blueprint-developers/intro",title:"Introduction",description:"Documentation for this page is yet to be written.",source:"@site/versioned_docs/version-1.49.0/for-developers/for-blueprint-developers/intro.md",sourceDirName:"for-developers/for-blueprint-developers",slug:"/for-developers/for-blueprint-developers/intro",permalink:"/sofie-core/docs/1.49.0/for-developers/for-blueprint-developers/intro",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.49.0/for-developers/for-blueprint-developers/intro.md",tags:[],version:"1.49.0",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"forDevelopers",previous:{title:"Contribution Guidelines",permalink:"/sofie-core/docs/1.49.0/for-developers/contribution-guidelines"},next:{title:"AB Playback",permalink:"/sofie-core/docs/1.49.0/for-developers/for-blueprint-developers/ab-playback"}},l={},p=[],c={toc:p},u="wrapper";function d(e){let{components:t,...n}=e;return(0,o.kt)(u,(0,r.Z)({},c,n,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"introduction"},"Introduction"),(0,o.kt)("div",{className:"admonition admonition-caution alert alert--warning"},(0,o.kt)("div",{parentName:"div",className:"admonition-heading"},(0,o.kt)("h5",{parentName:"div"},(0,o.kt)("span",{parentName:"h5",className:"admonition-icon"},(0,o.kt)("svg",{parentName:"span",xmlns:"http://www.w3.org/2000/svg",width:"16",height:"16",viewBox:"0 0 16 16"},(0,o.kt)("path",{parentName:"svg",fillRule:"evenodd",d:"M8.893 1.5c-.183-.31-.52-.5-.887-.5s-.703.19-.886.5L.138 13.499a.98.98 0 0 0 0 1.001c.193.31.53.501.886.501h13.964c.367 0 .704-.19.877-.5a1.03 1.03 0 0 0 .01-1.002L8.893 1.5zm.133 11.497H6.987v-2.003h2.039v2.003zm0-3.004H6.987V5.987h2.039v4.006z"}))),"caution")),(0,o.kt)("div",{parentName:"div",className:"admonition-content"},(0,o.kt)("p",{parentName:"div"},"Documentation for this page is yet to be written."))),(0,o.kt)("p",null,(0,o.kt)("a",{parentName:"p",href:"/sofie-core/docs/1.49.0/user-guide/concepts-and-architecture#blueprints"},"Blueprints")," are programs that run inside Sofie Core and interpret\ndata coming in from the Rundowns and transform that into playable elements. They use an API published in ",(0,o.kt)("a",{parentName:"p",href:"https://nrkno.github.io/sofie-core/typedoc/modules/_sofie_automation_blueprints_integration.html"},"@sofie-automation/blueprints-integration")," library to expose their functionality and communicate with Sofie Core."),(0,o.kt)("p",null,"Technically, a Blueprint is a JavaScript object, implementing one of the ",(0,o.kt)("inlineCode",{parentName:"p"},"BlueprintManifestBase")," interfaces."),(0,o.kt)("p",null,"Currently, there are three types of Blueprints:"),(0,o.kt)("ul",null,(0,o.kt)("li",{parentName:"ul"},(0,o.kt)("a",{parentName:"li",href:"https://nrkno.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.ShowStyleBlueprintManifest.html"},"Show Style Blueprints")," - handling converting NRCS Rundown data into Sofie Rundowns and content."),(0,o.kt)("li",{parentName:"ul"},(0,o.kt)("a",{parentName:"li",href:"https://nrkno.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.StudioBlueprintManifest.html"},"Studio Blueprints")," - handling selecting ShowStyles for a given NRCS Rundown and assigning NRCS Rundowns to Sofie Playlists"),(0,o.kt)("li",{parentName:"ul"},(0,o.kt)("a",{parentName:"li",href:"https://nrkno.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.SystemBlueprintManifest.html"},"System Blueprints")," - handling system provisioning and global configuration")))}d.isMDXComponent=!0}}]);