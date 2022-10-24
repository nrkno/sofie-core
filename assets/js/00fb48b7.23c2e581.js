"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[2253],{5318:function(e,t,n){n.d(t,{Zo:function(){return u},kt:function(){return f}});var a=n(7378);function r(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function i(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function l(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?i(Object(n),!0).forEach((function(t){r(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):i(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function o(e,t){if(null==e)return{};var n,a,r=function(e,t){if(null==e)return{};var n,a,r={},i=Object.keys(e);for(a=0;a<i.length;a++)n=i[a],t.indexOf(n)>=0||(r[n]=e[n]);return r}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(a=0;a<i.length;a++)n=i[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(r[n]=e[n])}return r}var s=a.createContext({}),d=function(e){var t=a.useContext(s),n=t;return e&&(n="function"==typeof e?e(t):l(l({},t),e)),n},u=function(e){var t=d(e.components);return a.createElement(s.Provider,{value:t},e.children)},m={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},p=a.forwardRef((function(e,t){var n=e.components,r=e.mdxType,i=e.originalType,s=e.parentName,u=o(e,["components","mdxType","originalType","parentName"]),p=d(n),f=r,c=p["".concat(s,".").concat(f)]||p[f]||m[f]||i;return n?a.createElement(c,l(l({ref:t},u),{},{components:n})):a.createElement(c,l({ref:t},u))}));function f(e,t){var n=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var i=n.length,l=new Array(i);l[0]=p;var o={};for(var s in t)hasOwnProperty.call(t,s)&&(o[s]=t[s]);o.originalType=e,o.mdxType="string"==typeof e?e:r,l[1]=o;for(var d=2;d<i;d++)l[d]=n[d];return a.createElement.apply(null,l)}return a.createElement.apply(null,n)}p.displayName="MDXCreateElement"},6599:function(e,t,n){n.r(t),n.d(t,{assets:function(){return u},contentTitle:function(){return s},default:function(){return f},frontMatter:function(){return o},metadata:function(){return d},toc:function(){return m}});var a=n(5773),r=n(808),i=(n(7378),n(5318)),l=["components"],o={sidebar_position:1},s="Sofie Core: System Configuration",d={unversionedId:"user-guide/configuration/sofie-core-settings",id:"user-guide/configuration/sofie-core-settings",title:"Sofie Core: System Configuration",description:"Sofie&nbsp;Core is configured at it's most basic level using a settings file and environment variables.",source:"@site/docs/user-guide/configuration/sofie-core-settings.md",sourceDirName:"user-guide/configuration",slug:"/user-guide/configuration/sofie-core-settings",permalink:"/sofie-core/docs/user-guide/configuration/sofie-core-settings",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/docs/user-guide/configuration/sofie-core-settings.md",tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"userGuide",previous:{title:"Concepts & Architecture",permalink:"/sofie-core/docs/user-guide/concepts-and-architecture"},next:{title:"Settings View",permalink:"/sofie-core/docs/user-guide/configuration/settings-view"}},u={},m=[{value:"Environment Variables",id:"environment-variables",level:3},{value:"Settings File",id:"settings-file",level:3}],p={toc:m};function f(e){var t=e.components,n=(0,r.Z)(e,l);return(0,i.kt)("wrapper",(0,a.Z)({},p,n,{components:t,mdxType:"MDXLayout"}),(0,i.kt)("h1",{id:"sofie-core-system-configuration"},"Sofie Core: System Configuration"),(0,i.kt)("p",null,(0,i.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," is configured at it's most basic level using a settings file and environment variables."),(0,i.kt)("h3",{id:"environment-variables"},"Environment Variables"),(0,i.kt)("table",null,(0,i.kt)("thead",null,(0,i.kt)("tr",null,(0,i.kt)("th",null,"Setting"),(0,i.kt)("th",null,"Use"),(0,i.kt)("th",null,"Default value"),(0,i.kt)("th",null,"Example"))),(0,i.kt)("tbody",null,(0,i.kt)("tr",null,(0,i.kt)("td",null,(0,i.kt)("code",null,"METEOR_SETTINGS")),(0,i.kt)("td",null,"Contents of settings file (see below)"),(0,i.kt)("td",null),(0,i.kt)("td",null,(0,i.kt)("code",null,"$(cat settings.json)"))),(0,i.kt)("tr",null,(0,i.kt)("td",null,(0,i.kt)("code",null,"NTP_SERVERS")),(0,i.kt)("td",null,"List of time servers to sync the system to (comma separated)."),(0,i.kt)("td",null,"0.pool.ntp.org,",(0,i.kt)("br",null),"1.pool.ntp.org,",(0,i.kt)("br",null),"2.pool.ntp.org"),(0,i.kt)("td",null)),(0,i.kt)("tr",null,(0,i.kt)("td",null,(0,i.kt)("code",null,"TZ")),(0,i.kt)("td",null,"The default time zone of the server (used in logging)"),(0,i.kt)("td",null),(0,i.kt)("td",null,(0,i.kt)("code",null,"Europe/Amsterdam"))),(0,i.kt)("tr",null,(0,i.kt)("td",null,(0,i.kt)("code",null,"MAIL_URL")),(0,i.kt)("td",null,"Email server to use. See"," ",(0,i.kt)("a",{href:"https://docs.meteor.com/api/email.html"},"https://docs.meteor.com/api/email.html")),(0,i.kt)("td",null),(0,i.kt)("td",null,(0,i.kt)("code",null,"smtps://USERNAME:PASSWORD@HOST:PORT"))),(0,i.kt)("tr",null,(0,i.kt)("td",null,(0,i.kt)("code",null,"LOG_TO_FILE")),(0,i.kt)("td",null,"File path to log to file"),(0,i.kt)("td",null),(0,i.kt)("td",null,(0,i.kt)("code",null,"/logs/core/"))))),(0,i.kt)("h3",{id:"settings-file"},"Settings File"),(0,i.kt)("p",null,"The settings file is an optional JSON file that contains some configuration settings for how the ",(0,i.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," works and behaves."),(0,i.kt)("p",null,"To use a settings file:"),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"During development: ",(0,i.kt)("inlineCode",{parentName:"li"},"meteor --settings settings.json")),(0,i.kt)("li",{parentName:"ul"},"During prod: environment variable ","(","see above",")")),(0,i.kt)("p",null,"The structure of the file allows for public and private fields. At the moment, Sofie only uses public fields. Below is an example settings file:"),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-text"},'{\n    "public": {\n        "frameRate": 25\n    }\n}\n')),(0,i.kt)("p",null,"There are various settings you can set for an installation. See the list below:"),(0,i.kt)("table",null,(0,i.kt)("thead",{parentName:"table"},(0,i.kt)("tr",{parentName:"thead"},(0,i.kt)("th",{parentName:"tr",align:"left"},(0,i.kt)("strong",{parentName:"th"},"Field name")),(0,i.kt)("th",{parentName:"tr",align:"left"},"Use"),(0,i.kt)("th",{parentName:"tr",align:"left"},"Default value"))),(0,i.kt)("tbody",{parentName:"table"},(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"frameRate")),(0,i.kt)("td",{parentName:"tr",align:"left"},"The framerate used to display time-codes in the GUI"),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"25"))),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"defaultToCollapsedSegments")),(0,i.kt)("td",{parentName:"tr",align:"left"},"Should all segments be collapsed by default, until the user expands them"),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"false"))),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"autoRewindLeavingSegment")),(0,i.kt)("td",{parentName:"tr",align:"left"},"Should segments be automatically rewound after they stop playing"),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"false"))),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"autoExpandCurrentNextSegment")),(0,i.kt)("td",{parentName:"tr",align:"left"},"Should the segments be expanded when they are On Air or Next, useful with ",(0,i.kt)("inlineCode",{parentName:"td"},"defaultToCollapsedSegments")),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"false"))),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"disableBlurBorder")),(0,i.kt)("td",{parentName:"tr",align:"left"},"Should a border be displayed around the Rundown View when it's not in focus and studio mode is enabled"),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"false"))),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"defaultTimeScale")),(0,i.kt)("td",{parentName:"tr",align:"left"},"An arbitrary number, defining the default zoom factor of the Timelines"),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"1"))),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"allowGrabbingTimeline")),(0,i.kt)("td",{parentName:"tr",align:"left"},"Can Segment Timelines be grabbed to scroll them?"),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"true"))),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"enableUserAccounts")),(0,i.kt)("td",{parentName:"tr",align:"left"},"Enables User Accounts and Authentication. If disabled, all user stations will be treated as a single, anonymous user"),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"false"))),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"allowUnsyncedSegments")),(0,i.kt)("td",{parentName:"tr",align:"left"},"Switches behavior between unsyncing entire Rundowns or just Segments"),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"false"))),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"allowRundownResetOnAir")),(0,i.kt)("td",{parentName:"tr",align:"left"},"Should the user be allowed to reset Rundowns when they are On Air"),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"false"))),(0,i.kt)("tr",{parentName:"tbody"},(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"defaultDisplayDuration")),(0,i.kt)("td",{parentName:"tr",align:"left"},"The fallback duration of a Part, when it's expectedDuration is 0. ","_","_","In milliseconds"),(0,i.kt)("td",{parentName:"tr",align:"left"},(0,i.kt)("inlineCode",{parentName:"td"},"3000"))))),(0,i.kt)("div",{className:"admonition admonition-info alert alert--info"},(0,i.kt)("div",{parentName:"div",className:"admonition-heading"},(0,i.kt)("h5",{parentName:"div"},(0,i.kt)("span",{parentName:"h5",className:"admonition-icon"},(0,i.kt)("svg",{parentName:"span",xmlns:"http://www.w3.org/2000/svg",width:"14",height:"16",viewBox:"0 0 14 16"},(0,i.kt)("path",{parentName:"svg",fillRule:"evenodd",d:"M7 2.3c3.14 0 5.7 2.56 5.7 5.7s-2.56 5.7-5.7 5.7A5.71 5.71 0 0 1 1.3 8c0-3.14 2.56-5.7 5.7-5.7zM7 1C3.14 1 0 4.14 0 8s3.14 7 7 7 7-3.14 7-7-3.14-7-7-7zm1 3H6v5h2V4zm0 6H6v2h2v-2z"}))),"info")),(0,i.kt)("div",{parentName:"div",className:"admonition-content"},(0,i.kt)("p",{parentName:"div"},"The exact definition for the settings can be found ",(0,i.kt)("a",{parentName:"p",href:"https://github.com/nrkno/sofie-core/blob/master/meteor/lib/Settings.ts#L12"},"in the code here"),"."))))}f.isMDXComponent=!0}}]);