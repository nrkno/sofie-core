"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[925],{4423:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>s,contentTitle:()=>o,default:()=>m,frontMatter:()=>r,metadata:()=>l,toc:()=>p});var a=n(5773),i=(n(7378),n(5318));const r={},o="Adding FFmpeg and FFprobe to your PATH on Windows",l={unversionedId:"user-guide/installation/installing-connections-and-additional-hardware/ffmpeg-installation",id:"version-1.46.0/user-guide/installation/installing-connections-and-additional-hardware/ffmpeg-installation",title:"Adding FFmpeg and FFprobe to your PATH on Windows",description:"Some parts of Sofie (specifically the Package Manager) require that FFmpeg and FFprobe be available in your PATH environment variable. This guide will go over how to download these executables and add them to your PATH.",source:"@site/versioned_docs/version-1.46.0/user-guide/installation/installing-connections-and-additional-hardware/ffmpeg-installation.md",sourceDirName:"user-guide/installation/installing-connections-and-additional-hardware",slug:"/user-guide/installation/installing-connections-and-additional-hardware/ffmpeg-installation",permalink:"/sofie-core/docs/1.46.0/user-guide/installation/installing-connections-and-additional-hardware/ffmpeg-installation",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.46.0/user-guide/installation/installing-connections-and-additional-hardware/ffmpeg-installation.md",tags:[],version:"1.46.0",frontMatter:{},sidebar:"version-1.45.0/userGuide",previous:{title:"Installing CasparCG Server for Sofie",permalink:"/sofie-core/docs/1.46.0/user-guide/installation/installing-connections-and-additional-hardware/casparcg-server-installation"},next:{title:"Configuring Vision Mixers",permalink:"/sofie-core/docs/1.46.0/user-guide/installation/installing-connections-and-additional-hardware/vision-mixers"}},s={},p=[{value:"Installation",id:"installation",level:3}],d={toc:p},c="wrapper";function m(e){let{components:t,...r}=e;return(0,i.kt)(c,(0,a.Z)({},d,r,{components:t,mdxType:"MDXLayout"}),(0,i.kt)("h1",{id:"adding-ffmpeg-and-ffprobe-to-your-path-on-windows"},"Adding FFmpeg and FFprobe to your PATH on Windows"),(0,i.kt)("p",null,"Some parts of Sofie (specifically the Package Manager) require that ",(0,i.kt)("a",{parentName:"p",href:"https://www.ffmpeg.org/"},(0,i.kt)("inlineCode",{parentName:"a"},"FFmpeg"))," and ",(0,i.kt)("a",{parentName:"p",href:"https://ffmpeg.org/ffprobe.html"},(0,i.kt)("inlineCode",{parentName:"a"},"FFprobe"))," be available in your ",(0,i.kt)("inlineCode",{parentName:"p"},"PATH")," environment variable. This guide will go over how to download these executables and add them to your ",(0,i.kt)("inlineCode",{parentName:"p"},"PATH"),"."),(0,i.kt)("h3",{id:"installation"},"Installation"),(0,i.kt)("ol",null,(0,i.kt)("li",{parentName:"ol"},(0,i.kt)("p",{parentName:"li"},(0,i.kt)("inlineCode",{parentName:"p"},"FFmpeg")," and ",(0,i.kt)("inlineCode",{parentName:"p"},"FFprobe")," can be downloaded from the ",(0,i.kt)("a",{parentName:"p",href:"https://ffmpeg.org/download.html"},"FFmpeg Downloads page"),' under the "Get packages & executable files" heading. At the time of writing, there are two sources of Windows builds: ',(0,i.kt)("inlineCode",{parentName:"p"},"gyan.dev")," and ",(0,i.kt)("inlineCode",{parentName:"p"},"BtbN")," -- either one will work.")),(0,i.kt)("li",{parentName:"ol"},(0,i.kt)("p",{parentName:"li"},"Once downloaded, extract the archive to some place permanent such as ",(0,i.kt)("inlineCode",{parentName:"p"},"C:\\Program Files\\FFmpeg"),"."),(0,i.kt)("ul",{parentName:"li"},(0,i.kt)("li",{parentName:"ul"},"You should end up with a ",(0,i.kt)("inlineCode",{parentName:"li"},"bin")," folder inside of ",(0,i.kt)("inlineCode",{parentName:"li"},"C:\\Program Files\\FFmpeg")," and in that ",(0,i.kt)("inlineCode",{parentName:"li"},"bin")," folder should be three executables: ",(0,i.kt)("inlineCode",{parentName:"li"},"ffmpeg.exe"),", ",(0,i.kt)("inlineCode",{parentName:"li"},"ffprobe.exe"),", and ",(0,i.kt)("inlineCode",{parentName:"li"},"ffplay.exe"),"."))),(0,i.kt)("li",{parentName:"ol"},(0,i.kt)("p",{parentName:"li"},"Open your Start Menu and type ",(0,i.kt)("inlineCode",{parentName:"p"},"path"),'. An option named "Edit the system environment variables" should come up. Click on that option to open the System Properties menu.'),(0,i.kt)("p",{parentName:"li"},(0,i.kt)("img",{alt:"Start Menu screenshot",src:n(4124).Z,width:"1039",height:"852"}))),(0,i.kt)("li",{parentName:"ol"},(0,i.kt)("p",{parentName:"li"},'In the System Properties menu, click the "Environment Varibles..." button at the bottom of the "Advanced" tab.'),(0,i.kt)("p",{parentName:"li"},(0,i.kt)("img",{alt:"System Properties screenshot",src:n(3580).Z,width:"546",height:"572"}))),(0,i.kt)("li",{parentName:"ol"},(0,i.kt)("p",{parentName:"li"},"If you installed ",(0,i.kt)("inlineCode",{parentName:"p"},"FFmpeg")," and ",(0,i.kt)("inlineCode",{parentName:"p"},"FFprobe")," to a system-wide location such as ",(0,i.kt)("inlineCode",{parentName:"p"},"C:\\Program Files\\FFmpeg"),", select and edit the ",(0,i.kt)("inlineCode",{parentName:"p"},"Path"),' variable under the "System variables" heading. Else, if you installed them to some place specific to your user account, edit the ',(0,i.kt)("inlineCode",{parentName:"p"},"Path"),' variable under the "User variables for <YOUR ACCOUNT NAME',">",'" heading.'),(0,i.kt)("p",{parentName:"li"},(0,i.kt)("img",{alt:"Environment Variables screenshot",src:n(5837).Z,width:"706",height:"777"}))),(0,i.kt)("li",{parentName:"ol"},(0,i.kt)("p",{parentName:"li"},'In the window that pops up when you click "Edit...", click "New" and enter the path to the ',(0,i.kt)("inlineCode",{parentName:"p"},"bin")," folder you extracted earlier. Then, click OK to add it."),(0,i.kt)("p",{parentName:"li"},(0,i.kt)("img",{alt:"Edit environment variable screenshot",src:n(3145).Z,width:"602",height:"664"}))),(0,i.kt)("li",{parentName:"ol"},(0,i.kt)("p",{parentName:"li"},'Click "OK" to close the Environment Variables window, and then click "OK" again to close the\nSystem Properties window.')),(0,i.kt)("li",{parentName:"ol"},(0,i.kt)("p",{parentName:"li"},"Verify that it worked by opening a Command Prompt and executing the following commands:"),(0,i.kt)("pre",{parentName:"li"},(0,i.kt)("code",{parentName:"pre",className:"language-cmd"},"ffmpeg -version\nffprobe -version\n")),(0,i.kt)("p",{parentName:"li"},"If you see version output from both of those commands, then you are all set! If not, double check the paths you entered and try restarting your computer."))))}m.isMDXComponent=!0},5318:(e,t,n)=>{n.d(t,{Zo:()=>d,kt:()=>f});var a=n(7378);function i(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function r(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);t&&(a=a.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,a)}return n}function o(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?r(Object(n),!0).forEach((function(t){i(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):r(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function l(e,t){if(null==e)return{};var n,a,i=function(e,t){if(null==e)return{};var n,a,i={},r=Object.keys(e);for(a=0;a<r.length;a++)n=r[a],t.indexOf(n)>=0||(i[n]=e[n]);return i}(e,t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);for(a=0;a<r.length;a++)n=r[a],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(i[n]=e[n])}return i}var s=a.createContext({}),p=function(e){var t=a.useContext(s),n=t;return e&&(n="function"==typeof e?e(t):o(o({},t),e)),n},d=function(e){var t=p(e.components);return a.createElement(s.Provider,{value:t},e.children)},c="mdxType",m={inlineCode:"code",wrapper:function(e){var t=e.children;return a.createElement(a.Fragment,{},t)}},u=a.forwardRef((function(e,t){var n=e.components,i=e.mdxType,r=e.originalType,s=e.parentName,d=l(e,["components","mdxType","originalType","parentName"]),c=p(n),u=i,f=c["".concat(s,".").concat(u)]||c[u]||m[u]||r;return n?a.createElement(f,o(o({ref:t},d),{},{components:n})):a.createElement(f,o({ref:t},d))}));function f(e,t){var n=arguments,i=t&&t.mdxType;if("string"==typeof e||i){var r=n.length,o=new Array(r);o[0]=u;var l={};for(var s in t)hasOwnProperty.call(t,s)&&(l[s]=t[s]);l.originalType=e,l[c]="string"==typeof e?e:i,o[1]=l;for(var p=2;p<r;p++)o[p]=n[p];return a.createElement.apply(null,o)}return a.createElement.apply(null,n)}u.displayName="MDXCreateElement"},3145:(e,t,n)=>{n.d(t,{Z:()=>a});const a=n.p+"assets/images/edit_path_environment_variable-1f646439e52a16d5fc4f70ad1b4dc104.png"},4124:(e,t,n)=>{n.d(t,{Z:()=>a});const a=n.p+"assets/images/edit_system_environment_variables-f3a021a86e3de7c21fee7f8aba212673.jpg"},5837:(e,t,n)=>{n.d(t,{Z:()=>a});const a=n.p+"assets/images/environment_variables-08e1b380a3dfe4e7746531335bca5ac0.png"},3580:(e,t,n)=>{n.d(t,{Z:()=>a});const a=n.p+"assets/images/system_properties-e5e8a7a6b27af5dbb164364daf2cf8bf.png"}}]);