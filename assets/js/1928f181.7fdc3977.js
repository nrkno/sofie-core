"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[7665],{68188:(e,n,i)=>{i.r(n),i.d(n,{assets:()=>l,contentTitle:()=>s,default:()=>h,frontMatter:()=>r,metadata:()=>o,toc:()=>d});var a=i(62540),t=i(43023);const r={title:"Installing CasparCG Server for Sofie",description:"Sofie specific fork of CasparCG&nbsp;Server 2.1"},s="Installing CasparCG\xa0Server for Sofie",o={id:"user-guide/installation/installing-connections-and-additional-hardware/casparcg-server-installation",title:"Installing CasparCG Server for Sofie",description:"Sofie specific fork of CasparCG&nbsp;Server 2.1",source:"@site/versioned_docs/version-1.49.0/user-guide/installation/installing-connections-and-additional-hardware/casparcg-server-installation.md",sourceDirName:"user-guide/installation/installing-connections-and-additional-hardware",slug:"/user-guide/installation/installing-connections-and-additional-hardware/casparcg-server-installation",permalink:"/sofie-core/docs/1.49.0/user-guide/installation/installing-connections-and-additional-hardware/casparcg-server-installation",draft:!1,unlisted:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.49.0/user-guide/installation/installing-connections-and-additional-hardware/casparcg-server-installation.md",tags:[],version:"1.49.0",frontMatter:{title:"Installing CasparCG Server for Sofie",description:"Sofie specific fork of CasparCG&nbsp;Server 2.1"},sidebar:"userGuide",previous:{title:"Additional Software & Hardware",permalink:"/sofie-core/docs/1.49.0/user-guide/installation/installing-connections-and-additional-hardware/"},next:{title:"Adding FFmpeg and FFprobe to your PATH on Windows",permalink:"/sofie-core/docs/1.49.0/user-guide/installation/installing-connections-and-additional-hardware/ffmpeg-installation"}},l={},d=[{value:"Installing the CasparCG\xa0Server",id:"installing-the-casparcgserver",level:2},{value:"Installing CasparCG Media Scanner",id:"installing-casparcg-media-scanner",level:3},{value:"Installing the CasparCG Launcher",id:"installing-the-casparcg-launcher",level:3},{value:"Configuring Windows",id:"configuring-windows",level:2},{value:"Required Software",id:"required-software",level:3},{value:"Hardware Recommendations",id:"hardware-recommendations",level:2},{value:"DeckLink Cards",id:"decklink-cards",level:3},{value:"Hardware-specific Configurations",id:"hardware-specific-configurations",level:2},{value:"Preview Only (Basic)",id:"preview-only-basic",level:3},{value:"Required Hardware",id:"required-hardware",level:4},{value:"Configuration",id:"configuration",level:4},{value:"Single DeckLink Card (Production Minimum)",id:"single-decklink-card-production-minimum",level:3},{value:"Required Hardware",id:"required-hardware-1",level:4},{value:"Configuration",id:"configuration-1",level:4},{value:"Multiple DeckLink Cards (Recommended Production Setup)",id:"multiple-decklink-cards-recommended-production-setup",level:3},{value:"Required Hardware",id:"required-hardware-2",level:4},{value:"Validating the Configuration File",id:"validating-the-configuration-file",level:3},{value:"Launching the Server",id:"launching-the-server",level:3},{value:"Connecting Sofie to the CasparCG\xa0Server",id:"connecting-sofie-to-the-casparcgserver",level:2},{value:"Further Reading",id:"further-reading",level:2}];function c(e){const n={a:"a",code:"code",del:"del",em:"em",h1:"h1",h2:"h2",h3:"h3",h4:"h4",img:"img",li:"li",p:"p",pre:"pre",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",ul:"ul",...(0,t.R)(),...e.components};return(0,a.jsxs)(a.Fragment,{children:[(0,a.jsx)(n.h1,{id:"installing-casparcgserver-for-sofie",children:"Installing CasparCG\xa0Server for Sofie"}),"\n",(0,a.jsx)(n.p,{children:"Although CasparCG\xa0Server is an open source program that is free to use for both personal and cooperate applications, the hardware needed to create and execute high quality graphics is not. You can get a preview running without any additional hardware but, it is not recommended to use CasparCG\xa0Server for production in this manner. To begin, you will install the CasparCG\xa0Server on your machine then add the additional configuration needed for your setup of choice."}),"\n",(0,a.jsx)(n.h2,{id:"installing-the-casparcgserver",children:"Installing the CasparCG\xa0Server"}),"\n",(0,a.jsxs)(n.p,{children:["To begin, download the latest release of ",(0,a.jsx)(n.a,{href:"https://github.com/nrkno/sofie-casparcg-server/releases",children:"CasparCG\xa0Server from GitHub"}),". There are multiple versions of CasparCG\xa0Server available to the public for download but, you specifically want the latest NRK version."]}),"\n",(0,a.jsxs)(n.p,{children:["Once downloaded, extract the files and navigate down the folders, ",(0,a.jsx)(n.em,{children:"CasparCG\xa0Server"})," then ",(0,a.jsx)(n.em,{children:"Server"}),". This folder contains your CasparCG\xa0Server Configuration file, ",(0,a.jsx)(n.code,{children:"casparcg.config"}),", and your CasparCG\xa0Server executable, ",(0,a.jsx)(n.code,{children:"casparcg.exe"}),"."]}),"\n",(0,a.jsxs)(n.p,{children:["How you will configure the CasparCG\xa0Server will depend on the number of DeckLink cards your machine contains. The first subsection for each CasparCG\xa0Server setup, labeled ",(0,a.jsx)(n.em,{children:"Channels"}),", will contain the unique portion of the configuration. The following is the majority of the configuration file that will be consistent between setups."]}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{className:"language-markup",children:'<?xml version="1.0" encoding="utf-8"?>\n<configuration>\n  <log-level>debug</log-level>\n  <thumbnails>\n    <generate-thumbnails>false</generate-thumbnails>\n  </thumbnails>\n  \x3c!-- Paths to the Server Media --\x3e\n  \x3c!-- Currently set to the same folder as this file --\x3e\n  <paths>\n    <media-path>media/</media-path>\n    <log-path>log/</log-path>\n    <data-path>data/</data-path>\n    <template-path>template/</template-path>\n    <thumbnail-path>thumbnail/</thumbnail-path>\n    <font-path>font/</font-path>\n  </paths>\n  <lock-clear-phrase>secret</lock-clear-phrase>\n  <channels>\n    \x3c!-- Unique portion of the configuration --\x3e\n  </channels>\n  <controllers>\n    <tcp>\n      <port>5250</port>\n      <protocol>AMCP</protocol>\n    </tcp>\n  <tcp>\n    <port>3250</port>\n    <protocol>LOG</protocol>\n  </tcp>\n  </controllers>\n</configuration>\n'})}),"\n",(0,a.jsxs)(n.p,{children:["One additional note, the Server does require the configuration file be named ",(0,a.jsx)(n.code,{children:"casparcg.config"}),"."]}),"\n",(0,a.jsx)(n.h3,{id:"installing-casparcg-media-scanner",children:"Installing CasparCG Media Scanner"}),"\n",(0,a.jsxs)(n.p,{children:["You can use the CasparCG Media Scanner to locate and add all of your media to the ",(0,a.jsx)(n.em,{children:"Sofie\xa0Core"}),". To install the Media Scanner, you will go to the ",(0,a.jsx)(n.a,{href:"https://github.com/nrkno/sofie-media-scanner/releases",children:"project's Release page"})," and download the ",(0,a.jsx)(n.code,{children:".zip"})," file under the latest release. Similar to the CasparCG\xa0Server, you want to use the NRK version."]}),"\n",(0,a.jsxs)(n.p,{children:["Once downloaded and extracted, move the ",(0,a.jsx)(n.code,{children:"scanner.exe"})," file to the same folder as your ",(0,a.jsx)(n.code,{children:"casparcg.exe"})," file."]}),"\n",(0,a.jsx)(n.h3,{id:"installing-the-casparcg-launcher",children:"Installing the CasparCG Launcher"}),"\n",(0,a.jsxs)(n.p,{children:["You can launch both of your CasparCG applications with the",(0,a.jsx)(n.a,{href:"https://github.com/nrkno/sofie-casparcg-launcher",children:" CasparCG Launcher."})," Download the ",(0,a.jsx)(n.code,{children:".exe"})," file in the latest release and once complete, move the file to the same folder as your ",(0,a.jsx)(n.code,{children:"casparcg.exe"})," file."]}),"\n",(0,a.jsx)(n.h2,{id:"configuring-windows",children:"Configuring Windows"}),"\n",(0,a.jsx)(n.h3,{id:"required-software",children:"Required Software"}),"\n",(0,a.jsxs)(n.p,{children:["Windows will require you install ",(0,a.jsx)(n.a,{href:"https://www.microsoft.com/en-us/download/details.aspx?id=52685",children:"Microsoft's Visual C++ 2015 Redistributable"})," to run the CasparCG\xa0Server properly. Before downloading the redistributable, please ensure it is not already installed on your system. Open your programs list and in the popup window, you can search for ",(0,a.jsx)(n.em,{children:"C++"})," in the search field. If ",(0,a.jsx)(n.em,{children:"Visual C++ 2015"})," appears, you do not need install the redistributable."]}),"\n",(0,a.jsxs)(n.p,{children:["If you need to install redistributable then, navigate to ",(0,a.jsx)(n.a,{href:"https://www.microsoft.com/en-us/download/details.aspx?id=52685",children:"Microsoft's website"})," and download it from there. Once downloaded, you can run the ",(0,a.jsx)(n.code,{children:".exe"})," file and follow the prompts."]}),"\n",(0,a.jsx)(n.h2,{id:"hardware-recommendations",children:"Hardware Recommendations"}),"\n",(0,a.jsx)(n.p,{children:"Although CasparCG\xa0Server can be run on some lower end hardware, it is only recommended to do so for non-production uses. Below is a table of the minimum and preferred specs depending on what type of system you are using."}),"\n",(0,a.jsxs)(n.table,{children:[(0,a.jsx)(n.thead,{children:(0,a.jsxs)(n.tr,{children:[(0,a.jsx)(n.th,{style:{textAlign:"left"},children:"System Type"}),(0,a.jsx)(n.th,{style:{textAlign:"left"},children:"Min CPU"}),(0,a.jsx)(n.th,{style:{textAlign:"left"},children:"Pref CPU"}),(0,a.jsx)(n.th,{style:{textAlign:"left"},children:"Min GPU"}),(0,a.jsx)(n.th,{style:{textAlign:"left"},children:"Pref GPU"}),(0,a.jsx)(n.th,{style:{textAlign:"left"},children:"Min Storage"}),(0,a.jsx)(n.th,{style:{textAlign:"left"},children:"Pref Storage"})]})}),(0,a.jsxs)(n.tbody,{children:[(0,a.jsxs)(n.tr,{children:[(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"Development"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"i5 Gen 6i7 Gen 6"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"GTX 1050"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"GTX 1060"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"GTX 1060"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"NVMe SSD 500gb"}),(0,a.jsx)(n.td,{style:{textAlign:"left"}})]}),(0,a.jsxs)(n.tr,{children:[(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"Prod, 1 Card"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"i7 Gen 6"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"i7 Gen 7"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"GTX 1060"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"GTX 1070"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"NVMe SSD 500gb"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"NVMe SSD 500gb"})]}),(0,a.jsxs)(n.tr,{children:[(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"Prod, 2 Cards"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"i9 Gen 8"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"i9 Gen 10 Extreme Edition"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"RTX 2070"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"Quadro P4000"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"Dual Drives"}),(0,a.jsx)(n.td,{style:{textAlign:"left"},children:"Dual Drives"})]})]})]}),"\n",(0,a.jsxs)(n.p,{children:["For ",(0,a.jsx)(n.em,{children:"dual drives"}),", it is recommended to use a smaller 250gb NVMe SSD for the operating system. Then a faster 1tb NVMe SSD for the CasparCG\xa0Server and media. It is also recommended to buy a drive with about 40% storage overhead. This is for SSD p",(0,a.jsx)(n.del,{children:"e"}),"rformance reasons and Sofie will warn you about this if your drive usage exceeds 60%."]}),"\n",(0,a.jsx)(n.h3,{id:"decklink-cards",children:"DeckLink Cards"}),"\n",(0,a.jsxs)(n.p,{children:["There are a few SDI cards made by Blackmagic Design that are supported by CasparCG. The base model, with four bi-directional input and outputs, is the ",(0,a.jsx)(n.a,{href:"https://www.blackmagicdesign.com/products/decklink/techspecs/W-DLK-31",children:"Duo 2"}),". If you need additional channels, use the",(0,a.jsx)(n.a,{href:"https://www.blackmagicdesign.com/products/decklink/techspecs/W-DLK-30",children:" Quad 4"})," which supports eight bi-directional inputs and outputs. Be aware the BNC connections are not the standard BNC type. B&H offers ",(0,a.jsx)(n.a,{href:"https://www.bhphotovideo.com/c/product/1462647-REG/canare_cal33mb018_mini_rg59_12g_sdi_4k.html",children:"Mini BNC to BNC connecters"}),". Finally, for 4k support, use the ",(0,a.jsx)(n.a,{href:"https://www.blackmagicdesign.com/products/decklink/techspecs/W-DLK-34",children:"8K Pro"})," which has four bi-directional BNC connections and one reference connection."]}),"\n",(0,a.jsxs)(n.p,{children:["Here is the Blackmagic Design PDF for ",(0,a.jsx)(n.a,{href:"https://documents.blackmagicdesign.com/UserManuals/DesktopVideoManual.pdf",children:"installing your DeckLink card ( Desktop Video Device )."})]}),"\n",(0,a.jsxs)(n.p,{children:["Once the card in installed in your machine, you will need to download the controller from Blackmagic's website. Navigate to ",(0,a.jsx)(n.a,{href:"https://www.blackmagicdesign.com/support/family/capture-and-playback",children:"this support page"}),", it will only display Desktop Video Support, and in the ",(0,a.jsx)(n.em,{children:"Latest Downloads"})," column download the most recent version of ",(0,a.jsx)(n.em,{children:"Desktop Video"}),". Before installing, save your work because Blackmagic's installers will force you to restart your machine."]}),"\n",(0,a.jsx)(n.p,{children:"Once booted back up, you should be able to launch the Desktop Video application and see your DeckLink card."}),"\n",(0,a.jsx)(n.p,{children:(0,a.jsx)(n.img,{alt:"Blackmagic Design&#39;s Desktop Video Application",src:i(97287).A+"",width:"958",height:"1008"})}),"\n",(0,a.jsx)(n.p,{children:"Click the icon in the center of the screen to open the setup window. Each production situation will very in frame rate and resolution so go through the settings and set what you know. Most things are set to standards based on your region so the default option will most likely be correct."}),"\n",(0,a.jsx)(n.p,{children:(0,a.jsx)(n.img,{alt:"Desktop Video Settings",src:i(76761).A+"",width:"958",height:"1008"})}),"\n",(0,a.jsx)(n.p,{children:"If you chose a DeckLink Duo, then you will also need to set SDI connectors one and two to be your outputs."}),"\n",(0,a.jsx)(n.p,{children:(0,a.jsx)(n.img,{alt:"DeckLink Duo SDI Output Settings",src:i(47066).A+"",width:"802",height:"742"})}),"\n",(0,a.jsx)(n.h2,{id:"hardware-specific-configurations",children:"Hardware-specific Configurations"}),"\n",(0,a.jsx)(n.h3,{id:"preview-only-basic",children:"Preview Only (Basic)"}),"\n",(0,a.jsxs)(n.p,{children:["A preview only version of CasparCG\xa0Server does not lack any of the features of a production version. It is called a ",(0,a.jsx)(n.em,{children:"preview only"})," version because the standard outputs on a computer, without a DeckLink card, do not meet the requirements of a high quality broadcast graphics machine. It is perfectly suitable for development though."]}),"\n",(0,a.jsx)(n.h4,{id:"required-hardware",children:"Required Hardware"}),"\n",(0,a.jsx)(n.p,{children:"No additional hardware is required, just the computer you have been using to follow this guide."}),"\n",(0,a.jsx)(n.h4,{id:"configuration",children:"Configuration"}),"\n",(0,a.jsx)(n.p,{children:"The default configuration will give you one preview window. No additional changes need to be made."}),"\n",(0,a.jsx)(n.h3,{id:"single-decklink-card-production-minimum",children:"Single DeckLink Card (Production Minimum)"}),"\n",(0,a.jsx)(n.h4,{id:"required-hardware-1",children:"Required Hardware"}),"\n",(0,a.jsxs)(n.p,{children:["To be production ready, you will need to output an SDI or HDMI signal from your production machine. CasparCG\xa0Server supports Blackmagic Design's DeckLink cards because they provide a key generator which will aid in keeping the alpha and fill channels of your graphics in sync. Please review the ",(0,a.jsx)(n.a,{href:"/sofie-core/docs/1.49.0/user-guide/installation/installing-connections-and-additional-hardware/casparcg-server-installation#decklink-cards",children:"DeckLink Cards"})," section of this page to choose which card will best fit your production needs."]}),"\n",(0,a.jsx)(n.h4,{id:"configuration-1",children:"Configuration"}),"\n",(0,a.jsxs)(n.p,{children:["You will need to add an additional consumer to your",(0,a.jsx)(n.code,{children:"caspar.config"})," file to output from your DeckLink card. After the screen consumer, add your new DeckLink consumer like so."]}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{className:"language-markup",children:"<channels>\n  <channel>\n    <video-mode>1080i5000</video-mode>\n    <channel-layout>stereo</channel-layout>\n    <consumers>\n      <screen>\n        <device>1</device>\n        <windowed>true</windowed>\n      </screen>\n      <system-audio></system-audio>\n      \x3c!-- New DeckLink Consumer Start --\x3e\n      <decklink>\n        <device>1</device>\n        <key-device>1</key-device>\n        <embedded-audio>true</embedded-audio>\n        <channel-layout>stereo</channel-layout>\n        <latency>normal</latency>\n        <keyer>external_separate_device</keyer>\n        <key-only>false</key-only>\n        <buffer-depth>3</buffer-depth>\n      </decklink>\n      \x3c!-- DeckLink Consumer End --\x3e\n    </consumers>\n  </channel>\n</channels>\n"})}),"\n",(0,a.jsx)(n.p,{children:"You may no longer need the screen consumer. If so, you can remove it and all of it's contents. This will dramatically improve overall performance."}),"\n",(0,a.jsx)(n.h3,{id:"multiple-decklink-cards-recommended-production-setup",children:"Multiple DeckLink Cards (Recommended Production Setup)"}),"\n",(0,a.jsx)(n.h4,{id:"required-hardware-2",children:"Required Hardware"}),"\n",(0,a.jsxs)(n.p,{children:["For a preferred production setup you want a minimum of two DeckLink Duo 2 cards. This is so you can use one card to preview your media, while your second card will support the program video and audio feeds. For CasparCG\xa0Server to recognize both cards, you need to add two additional channels to the ",(0,a.jsx)(n.code,{children:"caspar.config"})," file."]}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{className:"language-markup",children:"<channels>\n  <channel>\n    <video-mode>1080i5000</video-mode>\n    <channel-layout>stereo</channel-layout>\n    <consumers>\n      <screen>\n        <device>1</device>\n        <windowed>true</windowed>\n      </screen>\n      <system-audio></system-audio>\n      \x3c!-- New Preview DeckLink Consumer Start --\x3e\n      <decklink>\n        <device>1</device>\n        <key-device>1</key-device>\n        <embedded-audio>true</embedded-audio>\n        <channel-layout>stereo</channel-layout>\n        <latency>normal</latency>\n        <keyer>external_separate_device</keyer>\n        <key-only>false</key-only>\n        <buffer-depth>3</buffer-depth>\n      </decklink>\n      \x3c!-- Preview DeckLink Consumer End --\x3e\n      \x3c!-- New Program DeckLink Consumer Start --\x3e\n      <decklink>\n        <device>2</device>\n        <key-device>2</key-device>\n        <embedded-audio>true</embedded-audio>\n        <channel-layout>stereo</channel-layout>\n        <latency>normal</latency>\n        <keyer>external_separate_device</keyer>\n        <key-only>false</key-only>\n        <buffer-depth>3</buffer-depth>\n      </decklink>\n      \x3c!-- Program DeckLink Consumer End --\x3e\n    </consumers>\n  </channel>\n</channels>\n"})}),"\n",(0,a.jsx)(n.h3,{id:"validating-the-configuration-file",children:"Validating the Configuration File"}),"\n",(0,a.jsxs)(n.p,{children:["Once you have setup the configuration file, you can use an online validator to check and make sure it is setup correctly. Navigate to the ",(0,a.jsx)(n.a,{href:"https://casparcg.net/validator/",children:"CasparCG\xa0Server Config Validator"})," and paste in your entire configuration file. If there are any errors, they will be displayed at the bottom of the page."]}),"\n",(0,a.jsx)(n.h3,{id:"launching-the-server",children:"Launching the Server"}),"\n",(0,a.jsxs)(n.p,{children:["Launching the Server is the same for each hardware setup. This means you can run",(0,a.jsx)(n.code,{children:"casparcg-launcher.exe"})," and the server and media scanner will start. There will be two additional warning from Windows. The first is about the EXE file and can be bypassed by selecting ",(0,a.jsx)(n.em,{children:"Advanced"})," and then ",(0,a.jsx)(n.em,{children:"Run Anyways"}),". The second menu will be about CasparCG\xa0Server attempting to access your firewall. You will need to allow access."]}),"\n",(0,a.jsx)(n.p,{children:"A window will open and display the status for the server and scanner. You can start, stop, and/or restart the server from here if needed. An additional window should have opened as well. This is the main output of your CasparCG\xa0Server and will contain nothing but a black background for now. If you have a DeckLink card installed, its output will also be black."}),"\n",(0,a.jsx)(n.h2,{id:"connecting-sofie-to-the-casparcgserver",children:"Connecting Sofie to the CasparCG\xa0Server"}),"\n",(0,a.jsxs)(n.p,{children:["Now that your CasparCG\xa0Server software is running, you can connect it to the ",(0,a.jsx)(n.em,{children:"Sofie\xa0Core"}),". Navigate back to the ",(0,a.jsx)(n.em,{children:"Settings page"})," and in the menu, select the ",(0,a.jsx)(n.em,{children:"Playout Gateway"}),". If the ",(0,a.jsx)(n.em,{children:"Playout Gateway's"})," status does not read ",(0,a.jsx)(n.em,{children:"Good"}),", then please review the ",(0,a.jsx)(n.a,{href:"/sofie-core/docs/1.49.0/user-guide/installation/installing-a-gateway/playout-gateway",children:"Installing and Setting up the Playout Gateway"})," section of this guide."]}),"\n",(0,a.jsxs)(n.p,{children:["Under the Sub Devices section, you can add a new device with the ",(0,a.jsx)(n.em,{children:"+"})," button. Then select the pencil ( edit ) icon on the new device to open the sub device's settings. Select the ",(0,a.jsx)(n.em,{children:"Device Type"})," option and choose ",(0,a.jsx)(n.em,{children:"CasparCG"})," from the drop down menu. Some additional fields will be added to the form."]}),"\n",(0,a.jsxs)(n.p,{children:["The ",(0,a.jsx)(n.em,{children:"Host"})," and ",(0,a.jsx)(n.em,{children:"Launcher Host"})," fields will be ",(0,a.jsx)(n.em,{children:"localhost"}),". The ",(0,a.jsx)(n.em,{children:"Port"})," will be CasparCG's TCP port responsible for handling the AMCP commands. It defaults to 5052 in the ",(0,a.jsx)(n.code,{children:"casparcg.config"})," file. The ",(0,a.jsx)(n.em,{children:"Launcher Port"})," will be the CasparCG Launcher's port for handling HTTP requests. It will default to 8005 and can be changed in the ",(0,a.jsx)(n.em,{children:"Launcher's settings page"}),". Once all four fields are filled out, you can click the check mark to save the device."]}),"\n",(0,a.jsxs)(n.p,{children:["In the ",(0,a.jsx)(n.em,{children:"Attached Sub Devices"})," section, you should now see the status of the CasparCG\xa0Server. You may need to restart the Playout Gateway if the status is ",(0,a.jsx)(n.em,{children:"Bad"}),"."]}),"\n",(0,a.jsx)(n.h2,{id:"further-reading",children:"Further Reading"}),"\n",(0,a.jsxs)(n.ul,{children:["\n",(0,a.jsxs)(n.li,{children:[(0,a.jsx)(n.a,{href:"https://github.com/nrkno/sofie-casparcg-server/releases",children:"CasparCG\xa0Server Releases"})," on GitHub."]}),"\n",(0,a.jsxs)(n.li,{children:[(0,a.jsx)(n.a,{href:"https://github.com/nrkno/sofie-media-scanner/releases",children:"Media Scanner Releases"})," on GitHub."]}),"\n",(0,a.jsxs)(n.li,{children:[(0,a.jsx)(n.a,{href:"https://github.com/nrkno/sofie-casparcg-launcher",children:"CasparCG Launcher"})," on GitHub."]}),"\n",(0,a.jsxs)(n.li,{children:[(0,a.jsx)(n.a,{href:"https://www.microsoft.com/en-us/download/details.aspx?id=52685",children:"Microsoft Visual C++ 2015 Redistributable"})," on Microsoft's website."]}),"\n",(0,a.jsxs)(n.li,{children:[(0,a.jsx)(n.a,{href:"https://www.blackmagicdesign.com/products/decklink/models",children:"Blackmagic Design's DeckLink Cards"})," on Blackmagic's website. Check the ",(0,a.jsx)(n.a,{href:"/sofie-core/docs/1.49.0/user-guide/installation/installing-connections-and-additional-hardware/casparcg-server-installation#decklink-cards",children:"DeckLink cards"})," section for compatibility."]}),"\n",(0,a.jsxs)(n.li,{children:[(0,a.jsx)(n.a,{href:"https://documents.blackmagicdesign.com/UserManuals/DesktopVideoManual.pdf",children:"Installing a DeckLink Card"})," as a PDF."]}),"\n",(0,a.jsxs)(n.li,{children:[(0,a.jsx)(n.a,{href:"https://www.blackmagicdesign.com/support/family/capture-and-playback",children:"Desktop Video Download Page"})," on Blackmagic's website."]}),"\n",(0,a.jsx)(n.li,{children:(0,a.jsx)(n.a,{href:"https://casparcg.net/validator/",children:"CasparCG Configuration Validator"})}),"\n"]})]})}function h(e={}){const{wrapper:n}={...(0,t.R)(),...e.components};return n?(0,a.jsx)(n,{...e,children:(0,a.jsx)(c,{...e})}):c(e)}},47066:(e,n,i)=>{i.d(n,{A:()=>a});const a=i.p+"assets/images/decklink_duo_card-1efdcf5cbad3aa6b5088557aa7a5816f.png"},76761:(e,n,i)=>{i.d(n,{A:()=>a});const a=i.p+"assets/images/desktop-video-settings-3314805a50800497331ca33e52d581d2.png"},97287:(e,n,i)=>{i.d(n,{A:()=>a});const a=i.p+"assets/images/desktop-video-cdd07e390fa18aeb9ba60b13be9480d0.png"},43023:(e,n,i)=>{i.d(n,{R:()=>s,x:()=>o});var a=i(63696);const t={},r=a.createContext(t);function s(e){const n=a.useContext(r);return a.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(t):e.components||t:s(e.components),a.createElement(r.Provider,{value:n},e.children)}}}]);