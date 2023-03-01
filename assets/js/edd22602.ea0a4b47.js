"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[2830],{5318:(e,t,a)=>{a.d(t,{Zo:()=>m,kt:()=>N});var n=a(7378);function r(e,t,a){return t in e?Object.defineProperty(e,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[t]=a,e}function l(e,t){var a=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),a.push.apply(a,n)}return a}function o(e){for(var t=1;t<arguments.length;t++){var a=null!=arguments[t]?arguments[t]:{};t%2?l(Object(a),!0).forEach((function(t){r(e,t,a[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(a)):l(Object(a)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(a,t))}))}return e}function i(e,t){if(null==e)return{};var a,n,r=function(e,t){if(null==e)return{};var a,n,r={},l=Object.keys(e);for(n=0;n<l.length;n++)a=l[n],t.indexOf(a)>=0||(r[a]=e[a]);return r}(e,t);if(Object.getOwnPropertySymbols){var l=Object.getOwnPropertySymbols(e);for(n=0;n<l.length;n++)a=l[n],t.indexOf(a)>=0||Object.prototype.propertyIsEnumerable.call(e,a)&&(r[a]=e[a])}return r}var d=n.createContext({}),p=function(e){var t=n.useContext(d),a=t;return e&&(a="function"==typeof e?e(t):o(o({},t),e)),a},m=function(e){var t=p(e.components);return n.createElement(d.Provider,{value:t},e.children)},s={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},k=n.forwardRef((function(e,t){var a=e.components,r=e.mdxType,l=e.originalType,d=e.parentName,m=i(e,["components","mdxType","originalType","parentName"]),k=p(a),N=r,g=k["".concat(d,".").concat(N)]||k[N]||s[N]||l;return a?n.createElement(g,o(o({ref:t},m),{},{components:a})):n.createElement(g,o({ref:t},m))}));function N(e,t){var a=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var l=a.length,o=new Array(l);o[0]=k;var i={};for(var d in t)hasOwnProperty.call(t,d)&&(i[d]=t[d]);i.originalType=e,i.mdxType="string"==typeof e?e:r,o[1]=i;for(var p=2;p<l;p++)o[p]=a[p];return n.createElement.apply(null,o)}return n.createElement.apply(null,a)}k.displayName="MDXCreateElement"},7535:(e,t,a)=>{a.r(t),a.d(t,{assets:()=>d,contentTitle:()=>o,default:()=>s,frontMatter:()=>l,metadata:()=>i,toc:()=>p});var n=a(5773),r=(a(7378),a(5318));const l={sidebar_position:3},o="Prompter",i={unversionedId:"user-guide/features/prompter",id:"version-1.37.0/user-guide/features/prompter",title:"Prompter",description:"See Sofie views for how to access the prompter page.",source:"@site/versioned_docs/version-1.37.0/user-guide/features/prompter.md",sourceDirName:"user-guide/features",slug:"/user-guide/features/prompter",permalink:"/sofie-core/docs/1.37.0/user-guide/features/prompter",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.37.0/user-guide/features/prompter.md",tags:[],version:"1.37.0",sidebarPosition:3,frontMatter:{sidebar_position:3},sidebar:"version-1.37.0/gettingStarted",previous:{title:"Access Levels",permalink:"/sofie-core/docs/1.37.0/user-guide/features/access-levels"},next:{title:"Language",permalink:"/sofie-core/docs/1.37.0/user-guide/features/language"}},d={},p=[{value:"Customize looks",id:"customize-looks",level:2},{value:"Controlling the prompter",id:"controlling-the-prompter",level:2},{value:"Control using mouse (scroll wheel)",id:"control-using-mouse-scroll-wheel",level:4},{value:"Control using keyboard",id:"control-using-keyboard",level:4},{value:"Control using Contour ShuttleXpress or X-keys (<em>?mode=shuttlekeyboard</em>)",id:"control-using-contour-shuttlexpress-or-x-keys-modeshuttlekeyboard",level:4},{value:"Control using midi input (<em>?mode=pedal</em>)",id:"control-using-midi-input-modepedal",level:4},{value:"Control using Nintendo Joycon (<em>?mode=joycon</em>)",id:"control-using-nintendo-joycon-modejoycon",level:4}],m={toc:p};function s(e){let{components:t,...l}=e;return(0,r.kt)("wrapper",(0,n.Z)({},m,l,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"prompter"},"Prompter"),(0,r.kt)("p",null,"See ",(0,r.kt)("a",{parentName:"p",href:"sofie-views#prompter-view"},"Sofie views")," for how to access the prompter page."),(0,r.kt)("p",null,(0,r.kt)("img",{alt:"Prompter screen before the first Part is taken",src:a(6318).Z,width:"1920",height:"1080"})),(0,r.kt)("p",null,"The prompter will display the script for the Rundown currently active in the Studio. On Air and Next parts and segments are highlighted - in red and green, respectively - to aid in navigation. In top-right corner of the screen, a Diff clock is shown, showing the difference between planned playback and what has been actually produced. This allows the host to know how far behind/ahead they are in regards to planned execution."),(0,r.kt)("p",null,(0,r.kt)("img",{alt:"Indicators for the On Air and Next part shown underneath the Diff clock",src:a(5905).Z,width:"1920",height:"1080"})),(0,r.kt)("p",null,"If the user scrolls the prompter ahead or behind the On Air part, helpful indicators will be shown in the right-hand side of the screen. If the On Air or Next part's script is above the current viewport, arrows pointing up will be shown. If the On Air part's script is below the current viewport, a single arrow pointing down will be shown."),(0,r.kt)("h2",{id:"customize-looks"},"Customize looks"),(0,r.kt)("p",null,"The prompter UI can be configured using query parameters:"),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:"left"},"Query parameter"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Type"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Description"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Default"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"mirror")),(0,r.kt)("td",{parentName:"tr",align:"left"},"0 / 1"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Mirror the display horizontally"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"0"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"mirrorv")),(0,r.kt)("td",{parentName:"tr",align:"left"},"0 / 1"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Mirror the display vertically"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"0"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"fontsize")),(0,r.kt)("td",{parentName:"tr",align:"left"},"number"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Set a custom font size of the text. 20 will fit in 5 lines of text, 14 will fit 7 lines etc.."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"14"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"marker")),(0,r.kt)("td",{parentName:"tr",align:"left"},"string"),(0,r.kt)("td",{parentName:"tr",align:"left"},'Set position of the read-marker. Possible values: "center", "top", "bottom", "hide"'),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"hide"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"margin")),(0,r.kt)("td",{parentName:"tr",align:"left"},"number"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Set margin of screen ","(","used on monitors with overscan",")",", in %."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"0"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"showmarker")),(0,r.kt)("td",{parentName:"tr",align:"left"},"0 / 1"),(0,r.kt)("td",{parentName:"tr",align:"left"},'If the marker is not set to "hide", control if the marker is hidden or not'),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"1"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"showscroll")),(0,r.kt)("td",{parentName:"tr",align:"left"},"0 / 1"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Whether the scroll bar should be shown"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"1"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"followtake")),(0,r.kt)("td",{parentName:"tr",align:"left"},"0 / 1"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Whether the prompter should automatically scroll to current segment when the operator TAKE:s it"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"1"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"debug")),(0,r.kt)("td",{parentName:"tr",align:"left"},"0 / 1"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Whether to display a debug box showing controller input values and the calculated speed the prompter is currently scrolling at. Used to tweak speedMaps and ranges."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"0"))))),(0,r.kt)("p",null,"Example: ",(0,r.kt)("a",{parentName:"p",href:"http://127.0.0.1/prompter/studio0/?mode=mouse&followtake=0&fontsize=20"},"http://127.0.0.1/prompter/studio0/?mode=mouse&followtake=0&fontsize=20")),(0,r.kt)("h2",{id:"controlling-the-prompter"},"Controlling the prompter"),(0,r.kt)("p",null,"The prompter can be controlled by different types of controllers. The control mode is set by a query parameter, like so: ",(0,r.kt)("inlineCode",{parentName:"p"},"?mode=mouse"),"."),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:"left"},"Query parameter"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Description"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},"Default"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Controlled by both mouse and keyboard")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"?mode=mouse")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Controlled by mouse only. ",(0,r.kt)("a",{parentName:"td",href:"prompter#control-using-mouse-scroll-wheel"},"See configuration details"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"?mode=keyboard")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Controlled by keyboard only. ",(0,r.kt)("a",{parentName:"td",href:"prompter#control-using-keyboard"},"See configuration details"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"?mode=shuttlekeyboard")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Controlled by a Contour Design ShuttleXpress, X-keys Jog and Shuttle or any compatible, configured as keyboard-ish device. ",(0,r.kt)("a",{parentName:"td",href:"prompter#control-using-contour-shuttlexpress-or-x-keys"},"See configuration details"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"?mode=pedal")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Controlled by any MIDI device outputting note values between 0 - 127 of CC notes on channel 8. Analogue Expression pedals work well with TRS-USB midi-converters. ",(0,r.kt)("a",{parentName:"td",href:"prompter#control-using-midi-input-mode-pedal"},"See configuration details"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"?mode=joycon")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Controlled by Nintendo Switch Joycon, using the HTML5 GamePad API. ",(0,r.kt)("a",{parentName:"td",href:"prompter#control-using-nintendo-joycon-gamepad"},"See configuration details"))))),(0,r.kt)("h4",{id:"control-using-mouse-scroll-wheel"},"Control using mouse ","(","scroll wheel",")"),(0,r.kt)("p",null,"The prompter can be controlled in multiple ways when using the scroll wheel:"),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:"left"},"Query parameter"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Description"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"?controlmode=normal")),(0,r.kt)("td",{parentName:"tr",align:"left"},'Scrolling of the mouse works as "normal scrolling"')),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"?controlmode=speed")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Scrolling of the mouse changes the speed of scolling. Left-click to toggle, right-click to rewind")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"?controlmode=smoothscroll")),(0,r.kt)("td",{parentName:"tr",align:"left"},'Scrolling the mouse wheel starts continous scrolling. Small speed adjustments can then be made by nudging the scroll wheel. Stop the scrolling by making a "larger scroll" on the wheel.')))),(0,r.kt)("p",null,"has several operating modes, described further below. All modes are intended to be controlled by a computer mouse or similar, such as a presenter tool."),(0,r.kt)("h4",{id:"control-using-keyboard"},"Control using keyboard"),(0,r.kt)("p",null,'Keyboard control is intended to be used when having a "keyboard"-device, such as a presenter tool.'),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:"left"},"Scroll up"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Scroll down"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Arrow Up")),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Arrow Down"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Arrow Left")),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Arrow Right"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Page Up")),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Page Down"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"}),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Space"))))),(0,r.kt)("h4",{id:"control-using-contour-shuttlexpress-or-x-keys-modeshuttlekeyboard"},"Control using Contour ShuttleXpress or X-keys ","(",(0,r.kt)("em",{parentName:"h4"},"?mode=shuttlekeyboard"),")"),(0,r.kt)("p",null,"This mode is intended to be used when having a Contour ShuttleXpress or X-keys device, configured to work as a keyboard device. These devices have jog/shuttle wheels, and their software/firmware allow them to map scroll movement to keystrokes from any key-combination. Since we only listen for key combinations, it effectively means that any device outputing keystrokes will work in this mode."),(0,r.kt)("p",null,"From Release 30, the speedMap has a prefix: ",(0,r.kt)("strong",{parentName:"p"},"shuttle","_")," ","(","i.e. shuttle","_","speedMap",")"),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:"left"},"Key combination"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Function"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Ctrl")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Alt")," ",(0,r.kt)("inlineCode",{parentName:"td"},"F1")," ... ",(0,r.kt)("inlineCode",{parentName:"td"},"Ctrl")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Alt")," ",(0,r.kt)("inlineCode",{parentName:"td"},"F7")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Set speed to +1 ... +7 ","(","Scroll down",")")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Ctrl")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Shift")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Alt")," ",(0,r.kt)("inlineCode",{parentName:"td"},"F1")," ... ",(0,r.kt)("inlineCode",{parentName:"td"},"Ctrl")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Shift")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Alt")," ",(0,r.kt)("inlineCode",{parentName:"td"},"F7")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Set speed to -1 ... -7 ","(","Scroll up",")")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Ctrl")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Alt")," ",(0,r.kt)("inlineCode",{parentName:"td"},"+")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Increase speed")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Ctrl")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Alt")," ",(0,r.kt)("inlineCode",{parentName:"td"},"-")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Decrease speed")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Ctrl")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Alt")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Shift")," ",(0,r.kt)("inlineCode",{parentName:"td"},"F8"),", ",(0,r.kt)("inlineCode",{parentName:"td"},"Ctrl")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Alt")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Shift")," ",(0,r.kt)("inlineCode",{parentName:"td"},"PageDown")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Jump to next Segment and stop")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Ctrl")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Alt")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Shift")," ",(0,r.kt)("inlineCode",{parentName:"td"},"F9"),", ",(0,r.kt)("inlineCode",{parentName:"td"},"Ctrl")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Alt")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Shift")," ",(0,r.kt)("inlineCode",{parentName:"td"},"PageUp")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Jump to previous Segment and stop")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Ctrl")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Alt")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Shift")," ",(0,r.kt)("inlineCode",{parentName:"td"},"F10")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Jump to top of Script and stop")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Ctrl")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Alt")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Shift")," ",(0,r.kt)("inlineCode",{parentName:"td"},"F11")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Jump to Live and stop")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"Ctrl")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Alt")," ",(0,r.kt)("inlineCode",{parentName:"td"},"Shift")," ",(0,r.kt)("inlineCode",{parentName:"td"},"F12")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Jump to next Segment and stop")))),(0,r.kt)("p",null,"Configuration files that can be used in their respective driver software:"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-core/blob/release26/resources/prompter_layout_shuttlexpress.pref"},"Contour ShuttleXpress")),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("a",{parentName:"li",href:"https://github.com/nrkno/sofie-core/blob/release26/resources/prompter_layout_xkeys.mw3"},"X-keys"))),(0,r.kt)("h4",{id:""}),(0,r.kt)("h4",{id:"control-using-midi-input-modepedal"},"Control using midi input ","(",(0,r.kt)("em",{parentName:"h4"},"?mode=pedal"),")"),(0,r.kt)("p",null,"This mode listens to MIDI CC-notes on channel 8, expecting a linear range like i.e. 0-127. Sutiable for use with expression pedals, but any MIDI controller can be used. The mode picks the first connected MIDI device, and supports hot-swapping ","(","you can remove and add the device without refreshing the browser",")","."),(0,r.kt)("p",null,"If you want to use traditional analogue pedals with 5 volt TRS connection, a converter such as the ",(0,r.kt)("em",{parentName:"p"},"Beat Bars EX2M")," will work well."),(0,r.kt)("p",null,"From Release 30, the parameters for the pedal have a prefix: ",(0,r.kt)("strong",{parentName:"p"},"pedal","_")," ","(","i.e. pedal","_","speedMap, pedal","_","reverseSpeedMap etc",")"),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:"left"},"Query parameter"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Type"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Description"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Default"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"speedMap")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Array of numbers"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Speeds to scroll by ","(","px. pr. frame - approx 60fps",")"," when scrolling forwards. The beginning of the forwards-range maps to the first number in this array, and the end of the forwards-range map to the end of this array. All values in between are being interpolated using a spline curve."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"[1, 2, 3, 4, 5, 7, 9, 12, 17, 19, 30]"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"reverseSpeedMap")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Array of numbers"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Same as ",(0,r.kt)("inlineCode",{parentName:"td"},"speedMap")," but for the backwards range."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"[10, 30, 50]"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"rangeRevMin")),(0,r.kt)("td",{parentName:"tr",align:"left"},"number"),(0,r.kt)("td",{parentName:"tr",align:"left"},"The end of the backwards-range, full speed backwards."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"0"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"rangeNeutralMin")),(0,r.kt)("td",{parentName:"tr",align:"left"},"number"),(0,r.kt)("td",{parentName:"tr",align:"left"},"The beginning of the backwards-range."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"35"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"rangeNeutralMax")),(0,r.kt)("td",{parentName:"tr",align:"left"},"number"),(0,r.kt)("td",{parentName:"tr",align:"left"},"The minimum input to run forward, the start of the forward-range ","(","min speed",")",'. This is also the end of any "deadband" you want filter out before starting moving forwards.'),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"80"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"rangeFwdMax")),(0,r.kt)("td",{parentName:"tr",align:"left"},"number"),(0,r.kt)("td",{parentName:"tr",align:"left"},"The maximum input, the end of the forward-range ","(","max speed",")"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"127"))))),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("inlineCode",{parentName:"li"},"rangeNeutralMin")," has to be greater than ",(0,r.kt)("inlineCode",{parentName:"li"},"rangeRevMin")),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("inlineCode",{parentName:"li"},"rangeNeutralMax")," has to be greater than ",(0,r.kt)("inlineCode",{parentName:"li"},"rangeNeutralMin")),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("inlineCode",{parentName:"li"},"rangeFwdMax")," has to be greater than ",(0,r.kt)("inlineCode",{parentName:"li"},"rangeNeutralMax"))),(0,r.kt)("p",null,(0,r.kt)("img",{alt:"Yamaha FC7 mapped for both a forward (80-127) and backwards (0-35) range.",src:a(4171).Z,width:"1024",height:"672"})),(0,r.kt)("p",null,"The default values allow for both going forwards and backwards. This matches the ",(0,r.kt)("em",{parentName:"p"},"Yamaha FC7")," expression pedal. The default values create a forward-range from 80-127, a neutral zone from 35-80 and a reverse-range from 0-35."),(0,r.kt)("p",null,"Any movement within forward range will map to the ",(0,r.kt)("em",{parentName:"p"},"speedMap")," with interpolation between any numbers in the ",(0,r.kt)("em",{parentName:"p"},"speedMap"),". You can turn on ",(0,r.kt)("inlineCode",{parentName:"p"},"?debug=1")," to see how your input maps to an output. This helps during calibration. Similarly, any movement within the backwards rage maps to the ",(0,r.kt)("em",{parentName:"p"},"reverseSpeedMap.")),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},"Calibration guide:")),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:"left"},(0,r.kt)("strong",{parentName:"th"},"Symptom")),(0,r.kt)("th",{parentName:"tr",align:"left"},"Adjustment"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("em",{parentName:"td"},'"I can\'t rest my foot without it starting to run"')),(0,r.kt)("td",{parentName:"tr",align:"left"},"Increase ",(0,r.kt)("inlineCode",{parentName:"td"},"rangeNeutralMax"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("em",{parentName:"td"},'"I have to push too far before it starts moving"')),(0,r.kt)("td",{parentName:"tr",align:"left"},"Decrease ",(0,r.kt)("inlineCode",{parentName:"td"},"rangeNeutralMax"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("em",{parentName:"td"},'"It starts out fine, but runs too fast if I push too hard"')),(0,r.kt)("td",{parentName:"tr",align:"left"},"Add more weight to the lower part of the ",(0,r.kt)("inlineCode",{parentName:"td"},"speedMap")," by adding more low values early in the map, compared to the large numbers in the end.")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("em",{parentName:"td"},'"I have to go too far back to reverse"')),(0,r.kt)("td",{parentName:"tr",align:"left"},"Increse ",(0,r.kt)("inlineCode",{parentName:"td"},"rangeNeutralMin"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("em",{parentName:"td"},'"As I find a good speed, it varies a bit in speed up/down even if I hold my foot still"')),(0,r.kt)("td",{parentName:"tr",align:"left"},"Use ",(0,r.kt)("inlineCode",{parentName:"td"},"?debug=1")," to see what speed is calculated in the position the presenter wants to rest the foot in. Add more of that number in a sequence in the ",(0,r.kt)("inlineCode",{parentName:"td"},"speedMap")," to flatten out the speed curve, i.e. ",(0,r.kt)("inlineCode",{parentName:"td"},"[1, 2, 3, 4, 4, 4, 4, 5, ...]"))))),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},"Note:")," The default values are set up to work with the ",(0,r.kt)("em",{parentName:"p"},"Yamaha FC7")," expression pedal, and will probably not be good for pedals with one continuous linear range from fully released to fully depressed. A suggested configuration for such pedals ","(","i.e. the ",(0,r.kt)("em",{parentName:"p"},"Mission Engineering EP-1"),")"," will be like: "),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:"left"},"Query parameter"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Suggestion"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"speedMap")),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"[1, 2, 3, 4, 5, 7, 9, 12, 17, 19, 30]"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"reverseSpeedMap")),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"-2"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"rangeRevMin")),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"-1"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"rangeNeutralMin")),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"0"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"rangeNeutralMax")),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"1"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"rangeFwdMax")),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"127"))))),(0,r.kt)("h4",{id:"control-using-nintendo-joycon-modejoycon"},"Control using Nintendo Joycon ","(",(0,r.kt)("em",{parentName:"h4"},"?mode=joycon"),")"),(0,r.kt)("p",null,"This mode uses the browsers Gamapad API and polls connected Joycons for their states on button-presses and joystick inputs."),(0,r.kt)("p",null,"The Joycons can operate in 3 modes, the L-stick, the R-stick or both L+R sticks together. Reconnections and jumping between modes works, with one known limitation: ",(0,r.kt)("strong",{parentName:"p"},"Transition from L+R to a single stick blocks all input, and requires a reconnect of the sticks you want to use.")," This seems to be a bug in either the Joycons themselves or in the Gamepad API in general."),(0,r.kt)("p",null,"From Release 30, the parameters for the JoyCon have a prefix: ",(0,r.kt)("strong",{parentName:"p"},"joycon","_")," ","(","i.e. joycon","_","speedMap, joycon","_","reverseSpeedMap etc",")"),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:"left"},"Query parameter"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Type"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Description"),(0,r.kt)("th",{parentName:"tr",align:"left"},"Default"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"speedMap")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Array of numbes"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Speeds to scroll by ","(","px. pr. frame - approx 60fps",")"," when scrolling forwards. The beginning of the forwards-range maps to the first number in this array, and thee end of the forwards-range map to the end of this array. All values in between are being interpolated in a spline curve."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"[1, 2, 3, 4, 5, 8, 12, 30]"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"reverseSpeedMap")),(0,r.kt)("td",{parentName:"tr",align:"left"},"Array of numbers"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Same as ",(0,r.kt)("inlineCode",{parentName:"td"},"speedMap")," but for the backwards range."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"[1, 2, 3, 4, 5, 8, 12, 30]"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"rangeRevMin")),(0,r.kt)("td",{parentName:"tr",align:"left"},"number"),(0,r.kt)("td",{parentName:"tr",align:"left"},"The end of the backwards-range, full speed backwards."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"-1"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"rangeNeutralMin")),(0,r.kt)("td",{parentName:"tr",align:"left"},"number"),(0,r.kt)("td",{parentName:"tr",align:"left"},"The beginning of the backwards-range."),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"-0.25"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"rangeNeutralMax")),(0,r.kt)("td",{parentName:"tr",align:"left"},"number"),(0,r.kt)("td",{parentName:"tr",align:"left"},"The minimum input to run forward, the start of the forward-range ","(","min speed",")",'. This is also the end of any "deadband" you want filter out before starting moving forwards.'),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"0.25"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"rangeFwdMax")),(0,r.kt)("td",{parentName:"tr",align:"left"},"number"),(0,r.kt)("td",{parentName:"tr",align:"left"},"The maximum input, the end of the forward-range ","(","max speed",")"),(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("inlineCode",{parentName:"td"},"1"))))),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("inlineCode",{parentName:"li"},"rangeNeutralMin")," has to be greater than ",(0,r.kt)("inlineCode",{parentName:"li"},"rangeRevMin")),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("inlineCode",{parentName:"li"},"rangeNeutralMax")," has to be greater than ",(0,r.kt)("inlineCode",{parentName:"li"},"rangeNeutralMin")),(0,r.kt)("li",{parentName:"ul"},(0,r.kt)("inlineCode",{parentName:"li"},"rangeFwdMax")," has to be greater than ",(0,r.kt)("inlineCode",{parentName:"li"},"rangeNeutralMax"))),(0,r.kt)("p",null,(0,r.kt)("img",{alt:"Nintendo Swith Joycons",src:a(8632).Z,width:"1024",height:"1365"})),(0,r.kt)("p",null,"You can turn on ",(0,r.kt)("inlineCode",{parentName:"p"},"?debug=1")," to see how your input maps to an output."),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},"Button map:")),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:"left"},(0,r.kt)("strong",{parentName:"th"},"Button")),(0,r.kt)("th",{parentName:"tr",align:"left"},"Acton"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},"L2 / R2"),(0,r.kt)("td",{parentName:"tr",align:"left"},'Go to the "On-air" story')),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},"L / R"),(0,r.kt)("td",{parentName:"tr",align:"left"},'Go to the "Next" story')),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},"Up / X"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Go top the top")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},"Left / Y"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Go to the previous story")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},"Right / A"),(0,r.kt)("td",{parentName:"tr",align:"left"},"Go to the following story")))),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},"Calibration guide:")),(0,r.kt)("table",null,(0,r.kt)("thead",{parentName:"table"},(0,r.kt)("tr",{parentName:"thead"},(0,r.kt)("th",{parentName:"tr",align:"left"},(0,r.kt)("strong",{parentName:"th"},"Symptom")),(0,r.kt)("th",{parentName:"tr",align:"left"},"Adjustment"))),(0,r.kt)("tbody",{parentName:"table"},(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("em",{parentName:"td"},'"The prompter drifts upwards when I\'m not doing anything"')),(0,r.kt)("td",{parentName:"tr",align:"left"},"Decrease ",(0,r.kt)("inlineCode",{parentName:"td"},"rangeNeutralMin"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("em",{parentName:"td"},'"The prompter drifts downwards when I\'m not doing anything"')),(0,r.kt)("td",{parentName:"tr",align:"left"},"Increase ",(0,r.kt)("inlineCode",{parentName:"td"},"rangeNeutralMax"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("em",{parentName:"td"},'"It starts out fine, but runs too fast if I move too far"')),(0,r.kt)("td",{parentName:"tr",align:"left"},"Add more weight to the lower part of the ",(0,r.kt)("inlineCode",{parentName:"td"},"speedMap / reverseSpeedMap")," by adding more low values early in the map, compared to the large numbers in the end.")),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("em",{parentName:"td"},'"I can\'t reach max speed backwards"')),(0,r.kt)("td",{parentName:"tr",align:"left"},"Increase ",(0,r.kt)("inlineCode",{parentName:"td"},"rangeRevMin"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("em",{parentName:"td"},'"I can\'t reach max speed forwards"')),(0,r.kt)("td",{parentName:"tr",align:"left"},"Decrease ",(0,r.kt)("inlineCode",{parentName:"td"},"rangeFwdMax"))),(0,r.kt)("tr",{parentName:"tbody"},(0,r.kt)("td",{parentName:"tr",align:"left"},(0,r.kt)("em",{parentName:"td"},'"As I find a good speed, it varies a bit in speed up/down even if I hold my finger still"')),(0,r.kt)("td",{parentName:"tr",align:"left"},"Use ",(0,r.kt)("inlineCode",{parentName:"td"},"?debug=1")," to see what speed is calculated in the position the presenter wants to rest their finger in. Add more of that number in a sequence in the ",(0,r.kt)("inlineCode",{parentName:"td"},"speedMap")," to flatten out the speed curve, i.e. ",(0,r.kt)("inlineCode",{parentName:"td"},"[1, 2, 3, 4, 4, 4, 4, 5, ...]"))))))}s.isMDXComponent=!0},8632:(e,t,a)=>{a.d(t,{Z:()=>n});const n=a.p+"assets/images/nintendo-switch-joycons-9f7c4595c6f76773b7fa9b970223eded.jpg"},5905:(e,t,a)=>{a.d(t,{Z:()=>n});const n=a.p+"assets/images/prompter-view-indicators-7a51cbcd52654c02fae6efd878b2680f.png"},6318:(e,t,a)=>{a.d(t,{Z:()=>n});const n=a.p+"assets/images/prompter-view-95521a8b78dba5d16a0c4568924d2992.png"},4171:(e,t,a)=>{a.d(t,{Z:()=>n});const n=a.p+"assets/images/yamaha-fc7-66ad6a68c71535ccef12255efc266459.jpg"}}]);