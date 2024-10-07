"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[2117],{6099:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>a,default:()=>c,frontMatter:()=>i,metadata:()=>r,toc:()=>d});var o=n(62540),s=n(43023);const i={},a="Google Spreadsheet Gateway",r={id:"user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support",title:"Google Spreadsheet Gateway",description:"The Spreadsheet Gateway is an application for piping data between Sofie&nbsp;Core and Spreadsheets on Google Drive.",source:"@site/versioned_docs/version-1.47.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support.md",sourceDirName:"user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection",slug:"/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support",permalink:"/sofie-core/docs/1.47.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support",draft:!1,unlisted:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.47.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support.md",tags:[],version:"1.47.0",frontMatter:{},sidebar:"userGuide",previous:{title:"iNEWS Gateway",permalink:"/sofie-core/docs/1.47.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/inews-gateway"},next:{title:"Rundown & Newsroom Systems",permalink:"/sofie-core/docs/1.47.0/user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/intro"}},l={},d=[{value:"Example Blueprints for Spreadsheet Gateway",id:"example-blueprints-for-spreadsheet-gateway",level:3},{value:"Spreadsheet Gateway Configuration",id:"spreadsheet-gateway-configuration",level:3},{value:"Further Reading",id:"further-reading",level:3}];function h(e){const t={a:"a",code:"code",em:"em",h1:"h1",h3:"h3",img:"img",li:"li",p:"p",strong:"strong",ul:"ul",...(0,s.R)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(t.h1,{id:"google-spreadsheet-gateway",children:"Google Spreadsheet Gateway"}),"\n",(0,o.jsx)(t.p,{children:"The Spreadsheet Gateway is an application for piping data between Sofie\xa0Core and Spreadsheets on Google Drive."}),"\n",(0,o.jsx)(t.h3,{id:"example-blueprints-for-spreadsheet-gateway",children:"Example Blueprints for Spreadsheet Gateway"}),"\n",(0,o.jsxs)(t.p,{children:["To begin with, you will need to install a set of Blueprints that can handle the data being sent from the ",(0,o.jsx)(t.em,{children:"Gateway"})," to ",(0,o.jsx)(t.em,{children:"Sofie\xa0Core"}),". Download the ",(0,o.jsx)(t.code,{children:"demo-blueprints-r*.zip"})," file containing the blueprints you need from the ",(0,o.jsx)(t.a,{href:"https://github.com/SuperFlyTV/sofie-demo-blueprints/releases",children:"Demo Blueprints GitHub Repository"}),". It is recommended to choose the newest release but, an older ",(0,o.jsx)(t.em,{children:"Sofie\xa0Core"})," version may require a different Blueprint version. The ",(0,o.jsx)(t.em,{children:"Rundown page"})," will warn you about any issue and display the desired versions."]}),"\n",(0,o.jsxs)(t.p,{children:["Instructions on how to install any Blueprint can be found in the ",(0,o.jsx)(t.a,{href:"/sofie-core/docs/1.47.0/user-guide/installation/installing-blueprints",children:"Installing Blueprints"})," section from earlier."]}),"\n",(0,o.jsx)(t.h3,{id:"spreadsheet-gateway-configuration",children:"Spreadsheet Gateway Configuration"}),"\n",(0,o.jsxs)(t.p,{children:["If you are using the Docker version of Sofie, then the Spreadsheet Gateway will come preinstalled. For those who are not, please follow the ",(0,o.jsx)(t.a,{href:"https://github.com/SuperFlyTV/spreadsheet-gateway",children:"instructions listed on the GitHub page"})," labeled ",(0,o.jsx)(t.em,{children:"Installation (for developers)."})]}),"\n",(0,o.jsxs)(t.p,{children:["Once the Gateway has been installed, you can navigate to the ",(0,o.jsx)(t.em,{children:"Settings page"})," and check the newly added Gateway is listed as ",(0,o.jsx)(t.em,{children:"Spreadsheet Gateway"})," under the ",(0,o.jsx)(t.em,{children:"Devices section"}),"."]}),"\n",(0,o.jsxs)(t.p,{children:["Before you select the Device, you want to add it to the current ",(0,o.jsx)(t.em,{children:"Studio"})," you are using. Select your current Studio from the menu and navigate to the ",(0,o.jsx)(t.em,{children:"Attached Devices"})," option. Click the ",(0,o.jsx)(t.em,{children:"+"})," icon and select the Spreadsheet Gateway."]}),"\n",(0,o.jsxs)(t.p,{children:["Now you can select the ",(0,o.jsx)(t.em,{children:"Device"})," from the ",(0,o.jsx)(t.em,{children:"Devices menu"})," and click the link provided to enable your Google Drive API to send files to the ",(0,o.jsx)(t.em,{children:"Sofie\xa0Core"}),". The page that opens will look similar to the image below."]}),"\n",(0,o.jsxs)(t.p,{children:[(0,o.jsx)(t.img,{alt:"Nodejs Quickstart page",src:n(49034).A+"",width:"1541",height:"851"}),"\nxx\nMake sure to follow the steps in ",(0,o.jsx)(t.strong,{children:"Create a project and enable the API"})," and enable the ",(0,o.jsx)(t.strong,{children:"Google Drive API"})," as well as the ",(0,o.jsx)(t.strong,{children:"Google Sheets API"}),'. Your "APIs and services" Dashboard should now look as follows:']}),"\n",(0,o.jsx)(t.p,{children:(0,o.jsx)(t.img,{alt:"APIs and Services Dashboard",src:n(39628).A+"",width:"1541",height:"851"})}),"\n",(0,o.jsxs)(t.p,{children:["Now follow the steps in ",(0,o.jsx)(t.strong,{children:"Create credentials"})," and make sure to create an ",(0,o.jsx)(t.strong,{children:"OAuth Client ID"})," for a ",(0,o.jsx)(t.strong,{children:"Desktop App"})," and download the credentials file."]}),"\n",(0,o.jsx)(t.p,{children:(0,o.jsx)(t.img,{alt:"Create Credentials page",src:n(41542).A+"",width:"1541",height:"851"})}),"\n",(0,o.jsxs)(t.p,{children:["Use the button to download the configuration to a file and navigate back to ",(0,o.jsx)(t.em,{children:"Sofie\xa0Core's Settings page"}),". Select the Spreadsheet Gateway, then click the ",(0,o.jsx)(t.em,{children:"Browse"})," button and upload the configuration file you just downloaded. A new link will appear to confirm access to your google drive account. Select the link and in the new window, select the Google account you would like to use. Currently, the Sofie\xa0Core Application is not verified with Google so you will need to acknowledge this and proceed passed the unverified page. Click the ",(0,o.jsx)(t.em,{children:"Advanced"})," button and then click ",(0,o.jsx)(t.em,{children:"Go to QuickStart ( Unsafe )"}),"."]}),"\n",(0,o.jsxs)(t.p,{children:["After navigating through the prompts you are presented with your verification code. Copy this code into the input field on the ",(0,o.jsx)(t.em,{children:"Settings page"})," and the field should be removed. A message confirming the access token was saved will appear."]}),"\n",(0,o.jsxs)(t.p,{children:["You can now navigate to your Google Drive account and create a new folder for your rundowns. It is important that this folder has a unique name. Next, navigate back to ",(0,o.jsx)(t.em,{children:"Sofie\xa0Core's Settings page"})," and add the folder name to the appropriate input."]}),"\n",(0,o.jsxs)(t.p,{children:["The indicator should now read ",(0,o.jsx)(t.em,{children:"Good, Watching folder 'Folder Name Here'"}),". Now you just need an example rundown.",(0,o.jsx)(t.a,{href:"https://docs.google.com/spreadsheets/d/1iyegRv5MxYYtlVu8uEEMkBYXsLL-71PAMrNW0ZfWRUw/edit?usp=sharing",children:" Navigate to this Google Sheets file"})," and select the ",(0,o.jsx)(t.em,{children:"File"})," menu and then select ",(0,o.jsx)(t.em,{children:"Make a copy"}),". In the popup window, select ",(0,o.jsx)(t.em,{children:"My Drive"})," and then navigate to and select the rundowns folder you created earlier."]}),"\n",(0,o.jsxs)(t.p,{children:["At this point, one of two things will happen. If you have the Google Sheets API enabled, this is different from the Google Drive API you enabled earlier, then the Rundown you just copied will appear in the Rundown page and is accessible. The other outcome is the Spreadsheet Gateway status reads ",(0,o.jsx)(t.em,{children:"Unknown, Initializing..."})," which most likely means you need to enable the Google Sheets API. Navigate to the",(0,o.jsx)(t.a,{href:"https://console.developers.google.com/apis/library/sheets.googleapis.com?",children:" Google Sheets API Dashboard with this link"})," and click the ",(0,o.jsx)(t.em,{children:"Enable"})," button. Navigate back to ",(0,o.jsx)(t.em,{children:"Sofie's Settings page"})," and restart the Spreadsheet Gateway. The status should now read, ",(0,o.jsx)(t.em,{children:"Good, Watching folder 'Folder Name Here'"})," and the rundown will appear in the ",(0,o.jsx)(t.em,{children:"Rundown page"}),"."]}),"\n",(0,o.jsx)(t.h3,{id:"further-reading",children:"Further Reading"}),"\n",(0,o.jsxs)(t.ul,{children:["\n",(0,o.jsxs)(t.li,{children:[(0,o.jsx)(t.a,{href:"https://github.com/SuperFlyTV/sofie-demo-blueprints/",children:"Demo Blueprints"})," GitHub Page for Developers"]}),"\n",(0,o.jsxs)(t.li,{children:[(0,o.jsx)(t.a,{href:"https://docs.google.com/spreadsheets/d/1iyegRv5MxYYtlVu8uEEMkBYXsLL-71PAMrNW0ZfWRUw/edit?usp=sharing",children:"Example Rundown"})," provided by Sofie."]}),"\n",(0,o.jsxs)(t.li,{children:[(0,o.jsx)(t.a,{href:"https://console.developers.google.com/apis/library/sheets.googleapis.com?",children:"Google Sheets API"})," on the Google Developer website."]}),"\n",(0,o.jsxs)(t.li,{children:[(0,o.jsx)(t.a,{href:"https://github.com/SuperFlyTV/spreadsheet-gateway",children:"Spreadsheet Gateway"})," GitHub Page for Developers"]}),"\n"]})]})}function c(e={}){const{wrapper:t}={...(0,s.R)(),...e.components};return t?(0,o.jsx)(t,{...e,children:(0,o.jsx)(h,{...e})}):h(e)}},39628:(e,t,n)=>{n.d(t,{A:()=>o});const o=n.p+"assets/images/apis-and-services-dashboard-848db40581ffffcda429b3b3db805c70.png"},41542:(e,t,n)=>{n.d(t,{A:()=>o});const o=n.p+"assets/images/create-credentials-a4f8a433801082fc586b9b55b38d59de.png"},49034:(e,t,n)=>{n.d(t,{A:()=>o});const o=n.p+"assets/images/nodejs-quickstart-79400c9b984220155fe8e610761f2d45.png"},43023:(e,t,n)=>{n.d(t,{R:()=>a,x:()=>r});var o=n(63696);const s={},i=o.createContext(s);function a(e){const t=o.useContext(i);return o.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function r(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:a(e.components),o.createElement(i.Provider,{value:t},e.children)}}}]);