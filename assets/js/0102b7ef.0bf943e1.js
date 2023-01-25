"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[1130],{5318:function(e,t,n){n.d(t,{Zo:function(){return u},kt:function(){return h}});var a=n(7378);function o(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function r(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?r(Object(n),!0).forEach((function(t){o(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):r(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,a,o=function(e,t){if(null==e)return{};var n,a,o={},r=Object.keys(e);for(a=0;a<r.length;a++)n=r[a],t.indexOf(n)>=0||(o[n]=e[n]);return o}(e,t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);for(a=0;a<r.length;a++)n=r[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(o[n]=e[n])}return o}var l=a.createContext({}),p=function(e){var t=a.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},u=function(e){var t=p(e.components);return a.createElement(l.Provider,{value:t},e.children)},d={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},c=a.forwardRef((function(e,t){var n=e.components,o=e.mdxType,r=e.originalType,l=e.parentName,u=s(e,["components","mdxType","originalType","parentName"]),c=p(n),h=o,g=c["".concat(l,".").concat(h)]||c[h]||d[h]||r;return n?a.createElement(g,i(i({ref:t},u),{},{components:n})):a.createElement(g,i({ref:t},u))}));function h(e,t){var n=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var r=n.length,i=new Array(r);i[0]=c;var s={};for(var l in t)hasOwnProperty.call(t,l)&&(s[l]=t[l]);s.originalType=e,s.mdxType="string"==typeof e?e:o,i[1]=s;for(var p=2;p<r;p++)i[p]=n[p];return a.createElement.apply(null,i)}return a.createElement.apply(null,n)}c.displayName="MDXCreateElement"},6860:function(e,t,n){n.r(t),n.d(t,{assets:function(){return u},contentTitle:function(){return l},default:function(){return h},frontMatter:function(){return s},metadata:function(){return p},toc:function(){return d}});var a=n(5773),o=n(808),r=(n(7378),n(5318)),i=["components"],s={},l="Google Spreadsheet Gateway",p={unversionedId:"user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support",id:"version-1.37.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support",title:"Google Spreadsheet Gateway",description:"The Spreadsheet Gateway is an application for piping data between Sofie&nbsp;Core and Spreadsheets on Google Drive.",source:"@site/versioned_docs/version-1.37.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support.md",sourceDirName:"user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection",slug:"/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.37.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support.md",tags:[],version:"1.37.0",frontMatter:{},sidebar:"version-1.37.0/gettingStarted",previous:{title:"iNEWS Gateway",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/inews-gateway"},next:{title:"Rundown & Newsroom Systems",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/intro"}},u={},d=[{value:"Example Blueprints for Spreadsheet Gateway",id:"example-blueprints-for-spreadsheet-gateway",level:3},{value:"Spreadsheet Gateway Configuration",id:"spreadsheet-gateway-configuration",level:3},{value:"Further Reading",id:"further-reading",level:3}],c={toc:d};function h(e){var t=e.components,s=(0,o.Z)(e,i);return(0,r.kt)("wrapper",(0,a.Z)({},c,s,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"google-spreadsheet-gateway"},"Google Spreadsheet Gateway"),(0,r.kt)("p",null,"The Spreadsheet Gateway is an application for piping data between Sofie","\xa0","Core and Spreadsheets on Google Drive."),(0,r.kt)("h3",{id:"example-blueprints-for-spreadsheet-gateway"},"Example Blueprints for Spreadsheet Gateway"),(0,r.kt)("p",null,"To begin with, you will need to install a set of Blueprints that can handle the data being sent from the ",(0,r.kt)("em",{parentName:"p"},"Gateway")," to ",(0,r.kt)("em",{parentName:"p"},"Sofie","\xa0","Core"),". Download the ",(0,r.kt)("inlineCode",{parentName:"p"},"demo-blueprints-r*.zip")," file containing the blueprints you need from the ",(0,r.kt)("a",{parentName:"p",href:"https://github.com/SuperFlyTV/sofie-demo-blueprints/releases"},"Demo Blueprints GitHub Repository"),". It is recommended to choose the newest release but, an older ",(0,r.kt)("em",{parentName:"p"},"Sofie","\xa0","Core")," version may require a different Blueprint version. The ",(0,r.kt)("em",{parentName:"p"},"Rundown page")," will warn you about any issue and display the desired versions."),(0,r.kt)("p",null,"Instructions on how to install any Blueprint can be found in the ",(0,r.kt)("a",{parentName:"p",href:"../../installing-blueprints"},"Installing Blueprints")," section from earlier."),(0,r.kt)("h3",{id:"spreadsheet-gateway-configuration"},"Spreadsheet Gateway Configuration"),(0,r.kt)("p",null,"If you are using the Docker version of Sofie, then the Spreadsheet Gateway will come preinstalled. For those who are not, please follow the ",(0,r.kt)("a",{parentName:"p",href:"https://github.com/SuperFlyTV/spreadsheet-gateway"},"instructions listed on the GitHub page")," labeled ",(0,r.kt)("em",{parentName:"p"},"Installation ","(","for developers",")",".")),(0,r.kt)("p",null,"Once the Gateway has been installed, you can navigate to the ",(0,r.kt)("em",{parentName:"p"},"Settings page")," and check the newly added Gateway is listed as ",(0,r.kt)("em",{parentName:"p"},"Spreadsheet Gateway")," under the ",(0,r.kt)("em",{parentName:"p"},"Devices section"),"."),(0,r.kt)("p",null,"Before you select the Device, you want to add it to the current ",(0,r.kt)("em",{parentName:"p"},"Studio")," you are using. Select your current Studio from the menu and navigate to the ",(0,r.kt)("em",{parentName:"p"},"Attached Devices")," option. Click the ",(0,r.kt)("em",{parentName:"p"},"+")," icon and select the Spreadsheet Gateway."),(0,r.kt)("p",null,"Now you can select the ",(0,r.kt)("em",{parentName:"p"},"Device")," from the ",(0,r.kt)("em",{parentName:"p"},"Devices menu")," and click the link provided to enable your Google Drive API to send files to the ",(0,r.kt)("em",{parentName:"p"},"Sofie","\xa0","Core"),". The page that opens will look similar to the image below."),(0,r.kt)("p",null,(0,r.kt)("img",{alt:"Nodejs Quickstart page",src:n(5295).Z,width:"1541",height:"851"}),"\nxx\nMake sure to follow the steps in ",(0,r.kt)("strong",{parentName:"p"},"Create a project and enable the API")," and enable the ",(0,r.kt)("strong",{parentName:"p"},"Google Drive API")," as well as the ",(0,r.kt)("strong",{parentName:"p"},"Google Sheets API"),'. Your "APIs and services" Dashboard should now look as follows:'),(0,r.kt)("p",null,(0,r.kt)("img",{alt:"APIs and Services Dashboard",src:n(7750).Z,width:"1541",height:"851"})),(0,r.kt)("p",null,"Now follow the steps in ",(0,r.kt)("strong",{parentName:"p"},"Create credentials")," and make sure to create an ",(0,r.kt)("strong",{parentName:"p"},"OAuth Client ID")," for a ",(0,r.kt)("strong",{parentName:"p"},"Desktop App")," and download the credentials file."),(0,r.kt)("p",null,(0,r.kt)("img",{alt:"Create Credentials page",src:n(4601).Z,width:"1541",height:"851"})),(0,r.kt)("p",null,"Use the button to download the configuration to a file and navigate back to ",(0,r.kt)("em",{parentName:"p"},"Sofie","\xa0","Core's Settings page"),". Select the Spreadsheet Gateway, then click the ",(0,r.kt)("em",{parentName:"p"},"Browse")," button and upload the configuration file you just downloaded. A new link will appear to confirm access to your google drive account. Select the link and in the new window, select the Google account you would like to use. Currently, the Sofie","\xa0","Core Application is not verified with Google so you will need to acknowledge this and proceed passed the unverified page. Click the ",(0,r.kt)("em",{parentName:"p"},"Advanced")," button and then click ",(0,r.kt)("em",{parentName:"p"},"Go to QuickStart ","("," Unsafe ",")"),"."),(0,r.kt)("p",null,"After navigating through the prompts you are presented with your verification code. Copy this code into the input field on the ",(0,r.kt)("em",{parentName:"p"},"Settings page")," and the field should be removed. A message confirming the access token was saved will appear."),(0,r.kt)("p",null,"You can now navigate to your Google Drive account and create a new folder for your rundowns. It is important that this folder has a unique name. Next, navigate back to ",(0,r.kt)("em",{parentName:"p"},"Sofie","\xa0","Core's Settings page")," and add the folder name to the appropriate input."),(0,r.kt)("p",null,"The indicator should now read ",(0,r.kt)("em",{parentName:"p"},"Good, Watching folder 'Folder Name Here'"),". Now you just need an example rundown.",(0,r.kt)("a",{parentName:"p",href:"https://docs.google.com/spreadsheets/d/1iyegRv5MxYYtlVu8uEEMkBYXsLL-71PAMrNW0ZfWRUw/edit?usp=sharing"}," Navigate to this Google Sheets file")," and select the ",(0,r.kt)("em",{parentName:"p"},"File")," menu and then select ",(0,r.kt)("em",{parentName:"p"},"Make a copy"),". In the popup window, select ",(0,r.kt)("em",{parentName:"p"},"My Drive")," and then navigate to and select the rundowns folder you created earlier."),(0,r.kt)("p",null,"At this point, one of two things will happen. If you have the Google Sheets API enabled, this is different from the Google Drive API you enabled earlier, then the Rundown you just copied will appear in the Rundown page and is accessible. The other outcome is the Spreadsheet Gateway status reads ",(0,r.kt)("em",{parentName:"p"},"Unknown, Initializing...")," which most likely means you need to enable the Google Sheets API. Navigate to the",(0,r.kt)("a",{parentName:"p",href:"https://console.developers.google.com/apis/library/sheets.googleapis.com?"}," Google Sheets API Dashboard with this link")," and click the ",(0,r.kt)("em",{parentName:"p"},"Enable")," button. Navigate back to ",(0,r.kt)("em",{parentName:"p"},"Sofie's Settings page")," and restart the Spreadsheet Gateway. The status should now read, ",(0,r.kt)("em",{parentName:"p"},"Good, Watching folder 'Folder Name Here'")," and the rundown will appear in the ",(0,r.kt)("em",{parentName:"p"},"Rundown page"),"."),(0,r.kt)("h3",{id:"further-reading"},"Further Reading"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"https://github.com/SuperFlyTV/sofie-demo-blueprints/"},"Demo Blueprints")," GitHub Page for Developers"),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"https://docs.google.com/spreadsheets/d/1iyegRv5MxYYtlVu8uEEMkBYXsLL-71PAMrNW0ZfWRUw/edit?usp=sharing"},"Example Rundown")," provided by Sofie."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"https://console.developers.google.com/apis/library/sheets.googleapis.com?"},"Google Sheets API")," on the Google Developer website."),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"https://github.com/SuperFlyTV/spreadsheet-gateway"},"Spreadsheet Gateway")," GitHub Page for Developers")))}h.isMDXComponent=!0},7750:function(e,t,n){t.Z=n.p+"assets/images/apis-and-services-dashboard-dbac5e1f6d393ec9b4121065f3845ce4.png"},4601:function(e,t,n){t.Z=n.p+"assets/images/create-credentials-69f3321cdfaf27822def10c61f96b812.png"},5295:function(e,t,n){t.Z=n.p+"assets/images/nodejs-quickstart-8ff98a8151c7d0699a39f1e044d4b881.png"}}]);