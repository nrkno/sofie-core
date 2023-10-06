"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[5760],{5318:(e,n,t)=>{t.d(n,{Zo:()=>d,kt:()=>g});var i=t(7378);function a(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function r(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);n&&(i=i.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,i)}return t}function o(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?r(Object(t),!0).forEach((function(n){a(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):r(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function s(e,n){if(null==e)return{};var t,i,a=function(e,n){if(null==e)return{};var t,i,a={},r=Object.keys(e);for(i=0;i<r.length;i++)t=r[i],n.indexOf(t)>=0||(a[t]=e[t]);return a}(e,n);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);for(i=0;i<r.length;i++)t=r[i],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(a[t]=e[t])}return a}var l=i.createContext({}),c=function(e){var n=i.useContext(l),t=n;return e&&(t="function"==typeof e?e(n):o(o({},n),e)),t},d=function(e){var n=c(e.components);return i.createElement(l.Provider,{value:n},e.children)},u="mdxType",p={inlineCode:"code",wrapper:function(e){var n=e.children;return i.createElement(i.Fragment,{},n)}},m=i.forwardRef((function(e,n){var t=e.components,a=e.mdxType,r=e.originalType,l=e.parentName,d=s(e,["components","mdxType","originalType","parentName"]),u=c(t),m=a,g=u["".concat(l,".").concat(m)]||u[m]||p[m]||r;return t?i.createElement(g,o(o({ref:n},d),{},{components:t})):i.createElement(g,o({ref:n},d))}));function g(e,n){var t=arguments,a=n&&n.mdxType;if("string"==typeof e||a){var r=t.length,o=new Array(r);o[0]=m;var s={};for(var l in n)hasOwnProperty.call(n,l)&&(s[l]=n[l]);s.originalType=e,s[u]="string"==typeof e?e:a,o[1]=s;for(var c=2;c<r;c++)o[c]=t[c];return i.createElement.apply(null,o)}return i.createElement.apply(null,t)}m.displayName="MDXCreateElement"},7342:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>l,contentTitle:()=>o,default:()=>p,frontMatter:()=>r,metadata:()=>s,toc:()=>c});var i=t(5773),a=(t(7378),t(5318));const r={},o="Configuring Vision Mixers",s={unversionedId:"user-guide/installation/installing-connections-and-additional-hardware/vision-mixers",id:"version-1.37.0/user-guide/installation/installing-connections-and-additional-hardware/vision-mixers",title:"Configuring Vision Mixers",description:"ATEM \u2013 Blackmagic Design",source:"@site/versioned_docs/version-1.37.0/user-guide/installation/installing-connections-and-additional-hardware/vision-mixers.md",sourceDirName:"user-guide/installation/installing-connections-and-additional-hardware",slug:"/user-guide/installation/installing-connections-and-additional-hardware/vision-mixers",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/installing-connections-and-additional-hardware/vision-mixers",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.37.0/user-guide/installation/installing-connections-and-additional-hardware/vision-mixers.md",tags:[],version:"1.37.0",frontMatter:{},sidebar:"version-1.37.0/gettingStarted",previous:{title:"Adding FFmpeg and FFprobe to your PATH on Windows",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/installing-connections-and-additional-hardware/ffmpeg-installation"},next:{title:"Installing Package Manager",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/installing-package-manager"}},l={},c=[{value:"ATEM \u2013 Blackmagic Design",id:"atem--blackmagic-design",level:2},{value:"Connecting Sofie",id:"connecting-sofie",level:3},{value:"Additional Information",id:"additional-information",level:3}],d={toc:c},u="wrapper";function p(e){let{components:n,...t}=e;return(0,a.kt)(u,(0,i.Z)({},d,t,{components:n,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"configuring-vision-mixers"},"Configuring Vision Mixers"),(0,a.kt)("h2",{id:"atem--blackmagic-design"},"ATEM \u2013 Blackmagic Design"),(0,a.kt)("p",null,"The ",(0,a.kt)("a",{parentName:"p",href:"../installing-a-gateway/playout-gateway"},"Playout Gateway")," supports communicating with the entire line up of Blackmagic Design's ATEM vision mixers."),(0,a.kt)("h3",{id:"connecting-sofie"},"Connecting Sofie"),(0,a.kt)("p",null,"Once your ATEM is properly configured on the network, you can add it as a device to the Sofie","\xa0","Core. To begin, navigate to the ",(0,a.kt)("em",{parentName:"p"},"Settings page")," and select the ",(0,a.kt)("em",{parentName:"p"},"Playout Gateway")," under ",(0,a.kt)("em",{parentName:"p"},"Devices"),". Under the ",(0,a.kt)("em",{parentName:"p"},"Sub Devices")," section, you can add a new device with the ",(0,a.kt)("em",{parentName:"p"},"+")," button. Edit it the new device with the pencil ","("," edit ",")"," icon add the host IP and port for your ATEM. Once complete, you should see your ATEM in the ",(0,a.kt)("em",{parentName:"p"},"Attached Sub Devices")," section with a ",(0,a.kt)("em",{parentName:"p"},"Good")," status indicator."),(0,a.kt)("h3",{id:"additional-information"},"Additional Information"),(0,a.kt)("p",null,"Sofie does not support connecting to a vision mixer hardware panels. All interacts with the vision mixers must be handled within a Rundown."))}p.isMDXComponent=!0}}]);