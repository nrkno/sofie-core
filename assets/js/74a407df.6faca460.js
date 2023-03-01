"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[6303],{5318:(e,t,n)=>{n.d(t,{Zo:()=>m,kt:()=>f});var a=n(7378);function r(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function i(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function l(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?i(Object(n),!0).forEach((function(t){r(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):i(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function o(e,t){if(null==e)return{};var n,a,r=function(e,t){if(null==e)return{};var n,a,r={},i=Object.keys(e);for(a=0;a<i.length;a++)n=i[a],t.indexOf(n)>=0||(r[n]=e[n]);return r}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(a=0;a<i.length;a++)n=i[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(r[n]=e[n])}return r}var d=a.createContext({}),s=function(e){var t=a.useContext(d),n=t;return e&&(n="function"==typeof e?e(t):l(l({},t),e)),n},m=function(e){var t=s(e.components);return a.createElement(d.Provider,{value:t},e.children)},p={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},u=a.forwardRef((function(e,t){var n=e.components,r=e.mdxType,i=e.originalType,d=e.parentName,m=o(e,["components","mdxType","originalType","parentName"]),u=s(n),f=r,k=u["".concat(d,".").concat(f)]||u[f]||p[f]||i;return n?a.createElement(k,l(l({ref:t},m),{},{components:n})):a.createElement(k,l({ref:t},m))}));function f(e,t){var n=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var i=n.length,l=new Array(i);l[0]=u;var o={};for(var d in t)hasOwnProperty.call(t,d)&&(o[d]=t[d]);o.originalType=e,o.mdxType="string"==typeof e?e:r,l[1]=o;for(var s=2;s<i;s++)l[s]=n[s];return a.createElement.apply(null,l)}return a.createElement.apply(null,n)}u.displayName="MDXCreateElement"},8619:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>d,contentTitle:()=>l,default:()=>p,frontMatter:()=>i,metadata:()=>o,toc:()=>s});var a=n(5773),r=(n(7378),n(5318));const i={sidebar_position:1},l="Sofie Core: System Configuration",o={unversionedId:"user-guide/configuration/sofie-core-settings",id:"version-1.46.0/user-guide/configuration/sofie-core-settings",title:"Sofie Core: System Configuration",description:"Sofie&nbsp;Core is configured at it's most basic level using a settings file and environment variables.",source:"@site/versioned_docs/version-1.46.0/user-guide/configuration/sofie-core-settings.md",sourceDirName:"user-guide/configuration",slug:"/user-guide/configuration/sofie-core-settings",permalink:"/sofie-core/docs/1.46.0/user-guide/configuration/sofie-core-settings",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.46.0/user-guide/configuration/sofie-core-settings.md",tags:[],version:"1.46.0",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"version-1.45.0/userGuide",previous:{title:"Media Manager",permalink:"/sofie-core/docs/1.46.0/user-guide/installation/media-manager"},next:{title:"Settings View",permalink:"/sofie-core/docs/1.46.0/user-guide/configuration/settings-view"}},d={},s=[{value:"Environment Variables",id:"environment-variables",level:3},{value:"Settings File",id:"settings-file",level:3}],m={toc:s};function p(e){let{components:t,...n}=e;return(0,r.kt)("wrapper",(0,a.Z)({},m,n,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"sofie-core-system-configuration"},"Sofie Core: System Configuration"),(0,r.kt)("p",null,(0,r.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," is configured at it's most basic level using a settings file and environment variables."),(0,r.kt)("h3",{id:"environment-variables"},"Environment Variables"),(0,r.kt)("table",null,(0,r.kt)("thead",null,(0,r.kt)("tr",null,(0,r.kt)("th",null,"Setting"),(0,r.kt)("th",null,"Use"),(0,r.kt)("th",null,"Default value"),(0,r.kt)("th",null,"Example"))),(0,r.kt)("tbody",null,(0,r.kt)("tr",null,(0,r.kt)("td",null,(0,r.kt)("code",null,"METEOR_SETTINGS")),(0,r.kt)("td",null,"Contents of settings file (see below)"),(0,r.kt)("td",null),(0,r.kt)("td",null,(0,r.kt)("code",null,"$(cat settings.json)"))),(0,r.kt)("tr",null,(0,r.kt)("td",null,(0,r.kt)("code",null,"TZ")),(0,r.kt)("td",null,"The default time zone of the server (used in logging)"),(0,r.kt)("td",null),(0,r.kt)("td",null,(0,r.kt)("code",null,"Europe/Amsterdam"))),(0,r.kt)("tr",null,(0,r.kt)("td",null,(0,r.kt)("code",null,"MAIL_URL")),(0,r.kt)("td",null,"Email server to use. See"," ",(0,r.kt)("a",{href:"https://docs.meteor.com/api/email.html"},"https://docs.meteor.com/api/email.html")),(0,r.kt)("td",null),(0,r.kt)("td",null,(0,r.kt)("code",null,"smtps://USERNAME:PASSWORD@HOST:PORT"))),(0,r.kt)("tr",null,(0,r.kt)("td",null,(0,r.kt)("code",null,"LOG_TO_FILE")),(0,r.kt)("td",null,"File path to log to file"),(0,r.kt)("td",null),(0,r.kt)("td",null,(0,r.kt)("code",null,"/logs/core/"))))),(0,r.kt)("h3",{id:"settings-file"},"Settings File"),(0,r.kt)("p",null,"The settings file is an optional JSON file that contains some configuration settings for how the ",(0,r.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," works and behaves."),(0,r.kt)("p",null,"To use a settings file:"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"During development: ",(0,r.kt)("inlineCode",{parentName:"li"},"meteor --settings settings.json")),(0,r.kt)("li",{parentName:"ul"},"During prod: environment variable ","(","see above",")")),(0,r.kt)("p",null,"The structure of the file allows for public and private fields. At the moment, Sofie only uses public fields. Below is an example settings file:"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-text"},'{\n    "public": {\n        "frameRate": 25\n    }\n}\n')),(0,r.kt)("p",null,"There are various settings you can set for an installation. See the list below:"),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:"left"},(0,r.kt)("strong",{parentName:"th"},"Field name")),(0,r.kt)("th",{parentName:"tr",align:"left"},"Use"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Default value"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"defaultToCollapsedSegments")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Should all segments be collapsed by default, until the user expands them"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"false"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"autoRewindLeavingSegment")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Should segments be automatically rewound after they stop playing"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"false"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"disableBlurBorder")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Should a border be displayed around the Rundown View when it's not in focus and studio mode is enabled"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"false"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"defaultTimeScale")),(0,r.kt)("td",{parentName:"tr",align:"left"},"An arbitrary number, defining the default zoom factor of the Timelines"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"1"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"allowGrabbingTimeline")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Can Segment Timelines be grabbed to scroll them?"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"true"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"enableUserAccounts")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Enables User Accounts and Authentication. If disabled, all user stations will be treated as a single, anonymous user"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"false"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"defaultDisplayDuration")),(0,r.kt)("td",{parentName:"tr",align:"left"},"The fallback duration of a Part, when it's expectedDuration is 0. ","_","_","In milliseconds"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"3000"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"allowMultiplePlaylistsInGUI")),(0,r.kt)("td",{parentName:"tr",align:"left"},"If true, allows creation of new playlists in the Lobby Gui (rundown list). If false; only pre-existing playlists are allowed."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"false"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"followOnAirSegmentsHistory")),(0,r.kt)("td",{parentName:"tr",align:"left"},"How many segments of history to show when scrolling back in time (0 = show current segment only)"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"0"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"maximumDataAge")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Clean up stuff that are older than this ","[ms]",")"),(0,r.kt)("td",{parentName:"tr",align:"left"},"100 days")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"poisonKey")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Enable the use of poison key if present and use the key specified."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"'Escape'"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"enableNTPTimeChecker")),(0,r.kt)("td",{parentName:"tr",align:"left"},"If set, enables a check to ensure that the system time doesn't differ too much from the speficied NTP server time."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"null"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"defaultShelfDisplayOptions")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Default value used to toggle Shelf options when the 'display' URL argument is not provided."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"buckets,layout,shelfLayout,inspector"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"enableKeyboardPreview")),(0,r.kt)("td",{parentName:"tr",align:"left"},"The KeyboardPreview is a feature that is not implemented in the main Fork, and is kept here for compatibility"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"false"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"keyboardMapLayout")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Keyboard map layout (what physical layout to use for the keyboard)"),(0,r.kt)("td",{parentName:"tr",align:"left"},"STANDARD_102_TKL")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"customizationClassName")),(0,r.kt)("td",{parentName:"tr",align:"left"},"CSS class applied to the body of the page. Used to include custom implementations that differ from the main Fork."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"undefined"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"useCountdownToFreezeFrame")),(0,r.kt)("td",{parentName:"tr",align:"left"},"If true, countdowns of videos will count down to the last freeze-frame of the video instead of to the end of the video"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"true"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"confirmKeyCode")),(0,r.kt)("td",{parentName:"tr",align:"left"},'Which keyboard key is used as "Confirm" in modal dialogs etc.'),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"'Enter'"))))),(0,r.kt)("div",{className:"admonition admonition-info alert alert--info"},(0,r.kt)("div",{parentName:"div",className:"admonition-heading"},(0,r.kt)("h5",{parentName:"div"},(0,r.kt)("span",{parentName:"h5",className:"admonition-icon"},(0,r.kt)("svg",{parentName:"span",xmlns:"http://www.w3.org/2000/svg",width:"14",height:"16",viewBox:"0 0 14 16"},(0,r.kt)("path",{parentName:"svg",fillRule:"evenodd",d:"M7 2.3c3.14 0 5.7 2.56 5.7 5.7s-2.56 5.7-5.7 5.7A5.71 5.71 0 0 1 1.3 8c0-3.14 2.56-5.7 5.7-5.7zM7 1C3.14 1 0 4.14 0 8s3.14 7 7 7 7-3.14 7-7-3.14-7-7-7zm1 3H6v5h2V4zm0 6H6v2h2v-2z"}))),"info")),(0,r.kt)("div",{parentName:"div",className:"admonition-content"},(0,r.kt)("p",{parentName:"div"},"The exact definition for the settings can be found ",(0,r.kt)("a",{parentName:"p",href:"https://github.com/nrkno/sofie-core/blob/master/meteor/lib/Settings.ts#L12"},"in the code here"),"."))))}p.isMDXComponent=!0}}]);