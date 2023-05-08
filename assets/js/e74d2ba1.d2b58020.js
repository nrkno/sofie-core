"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[9292],{7073:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>i,default:()=>u,frontMatter:()=>a,metadata:()=>s,toc:()=>p});var o=n(5773),r=(n(7378),n(5318));const a={sidebar_position:2},i="Quick install",s={unversionedId:"user-guide/installation/installing-sofie-server-core",id:"version-1.37.0/user-guide/installation/installing-sofie-server-core",title:"Quick install",description:"Installing for testing \\(or production\\)",source:"@site/versioned_docs/version-1.37.0/user-guide/installation/installing-sofie-server-core.md",sourceDirName:"user-guide/installation",slug:"/user-guide/installation/installing-sofie-server-core",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/installing-sofie-server-core",draft:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.37.0/user-guide/installation/installing-sofie-server-core.md",tags:[],version:"1.37.0",sidebarPosition:2,frontMatter:{sidebar_position:2},sidebar:"version-1.37.0/gettingStarted",previous:{title:"Getting Started",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/intro"},next:{title:"Initial Sofie Core Setup",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/initial-sofie-core-setup"}},l={},p=[{value:"Installing for testing (or production)",id:"installing-for-testing-or-production",level:2},{value:"<strong>Prerequisites</strong>",id:"prerequisites",level:3},{value:"Installation",id:"installation",level:3},{value:"Tips for running in production",id:"tips-for-running-in-production",level:3},{value:"Installing for Development",id:"installing-for-development",level:2}],d={toc:p},c="wrapper";function u(e){let{components:t,...n}=e;return(0,r.kt)(c,(0,o.Z)({},d,n,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"quick-install"},"Quick install"),(0,r.kt)("h2",{id:"installing-for-testing-or-production"},"Installing for testing ","(","or production",")"),(0,r.kt)("h3",{id:"prerequisites"},(0,r.kt)("strong",{parentName:"h3"},"Prerequisites")),(0,r.kt)("p",null,(0,r.kt)("strong",{parentName:"p"},"(","Linux",")")," Install ",(0,r.kt)("a",{parentName:"p",href:"https://docs.docker.com/install/linux/docker-ce/ubuntu/"},"Docker")," and ",(0,r.kt)("a",{parentName:"p",href:"https://www.digitalocean.com/community/tutorials/how-to-install-docker-compose-on-ubuntu-18-04"},"docker-compose"),".",(0,r.kt)("br",{parentName:"p"}),"\n",(0,r.kt)("strong",{parentName:"p"},"(","Windows",")")," Install ",(0,r.kt)("a",{parentName:"p",href:"https://hub.docker.com/editions/community/docker-ce-desktop-windows"},"Docker for Windows"),"."),(0,r.kt)("h3",{id:"installation"},"Installation"),(0,r.kt)("p",null,"This docker-compose file automates the basic setup of the ",(0,r.kt)("a",{parentName:"p",href:"../../for-developers/libraries#main-application"},"Sofie-Core application"),", the backend database and different Gateway options."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-yaml"},"# This is NOT recommended to be used for a production deployment.\n# It aims to quickly get an evaluation version of Sofie running and serve as a basis for how to set up a production deployment.\nversion: '3.3'\nservices:\n  db:\n    hostname: mongo\n    image: mongo:4.2.18\n    restart: always\n    entrypoint: ['/usr/bin/mongod', '--replSet', 'rs0', '--bind_ip_all']\n    # the healthcheck avoids the need to initiate the replica set\n    healthcheck:\n      test: test $$(echo \"rs.initiate().ok || rs.status().ok\" | mongo --quiet) -eq 1\n      interval: 10s\n      start_period: 30s\n    ports:\n      - '27017:27017'\n    volumes:\n      - db-data:/data/db\n    networks:\n      - sofie\n\n  core:\n    hostname: core\n    image: sofietv/tv-automation-server-core:release37\n    restart: always\n    ports:\n      - '3000:3000' # Same port as meteor uses by default\n    environment:\n      PORT: '3000'\n      MONGO_URL: 'mongodb://db:27017/meteor'\n      MONGO_OPLOG_URL: 'mongodb://db:27017/local'\n      ROOT_URL: 'http://localhost:3000'\n    networks:\n      - sofie\n    volumes:\n      - snapshots:/mnt/snapshots\n    depends_on:\n      - db\n\n  playout-gateway:\n    image: sofietv/tv-automation-playout-gateway:release37\n    restart: always\n    command: yarn start -host core -port 3000 -id playoutGateway0\n    networks:\n      - sofie\n      - lan_access\n    depends_on:\n      - core\n\n  # Choose one of the following images, depending on which type of ingest gateway is wanted.\n  # If using the Rundown Editor, then none of the below images are needed.\n  # The Rundown Editor can be found here: https://github.com/SuperFlyTV/sofie-automation-rundown-editor\n\n  # spreadsheet-gateway:\n  #   image: superflytv/sofie-spreadsheet-gateway:latest\n  #   restart: always\n  #   command: yarn start -host core -port 3000 -id spreadsheetGateway0\n  #   networks:\n  #     - sofie\n  #   depends_on:\n  #     - core\n\n  # mos-gateway:\n  #   image: sofietv/tv-automation-mos-gateway:release37\n  #   restart: always\n  #   ports:\n  #     - \"10540:10540\" # MOS Lower port\n  #     - \"10541:10541\" # MOS Upper port\n  #     # - \"10542:10542\" # MOS query port - not used\n  #   command: yarn start -host core -port 3000 -id mosGateway0\n  #   networks:\n  #     - sofie\n  #   depends_on:\n  #     - core\n\n  # inews-gateway:\n  #   image: tv2media/inews-ftp-gateway:1.37.0-in-testing.20\n  #   restart: always\n  #   command: yarn start -host core -port 3000 -id inewsGateway0\n  #   networks:\n  #     - sofie\n  #   depends_on:\n  #     - core\n\nnetworks:\n  sofie:\n  lan_access:\n    driver: bridge\n\nvolumes:\n  db-data:\n  snapshots:\n")),(0,r.kt)("p",null,"Create a ",(0,r.kt)("inlineCode",{parentName:"p"},"Sofie")," folder, copy the above content, and save it as ",(0,r.kt)("inlineCode",{parentName:"p"},"docker-compose.yaml")," within the ",(0,r.kt)("inlineCode",{parentName:"p"},"Sofie")," folder."),(0,r.kt)("p",null,"Navigate to the ",(0,r.kt)("em",{parentName:"p"},"ingest-gateway")," section of ",(0,r.kt)("inlineCode",{parentName:"p"},"docker-compose.yaml")," and select which type of ",(0,r.kt)("em",{parentName:"p"},"ingest-gateway")," you'd like installed by uncommenting it. Save your changes. If you are using the ",(0,r.kt)("a",{parentName:"p",href:"rundown-editor"},"Rundown Editor"),", then no ingest gateways need to be uncommented."),(0,r.kt)("p",null,"Then open a terminal, ",(0,r.kt)("inlineCode",{parentName:"p"},"cd your-sofie-folder")," and ",(0,r.kt)("inlineCode",{parentName:"p"},"sudo docker-compose up")," ","(","just ",(0,r.kt)("inlineCode",{parentName:"p"},"docker-compose up")," on Windows",")","."),(0,r.kt)("p",null,"Once the installation is done, Sofie should be running on ",(0,r.kt)("a",{parentName:"p",href:"http://localhost:3000"},"http://localhost:3000")),(0,r.kt)("p",null,"Next, you will need to install a Rundown Gateway. Visit ",(0,r.kt)("a",{parentName:"p",href:"installing-a-gateway/rundown-or-newsroom-system-connection/intro"},"Rundowns\xa0&\xa0Newsroom Systems")," to see which ",(0,r.kt)("em",{parentName:"p"},"Rundown Gateway")," is best suited for ",(0,r.kt)("em",{parentName:"p"},"your")," production environment."),(0,r.kt)("h3",{id:"tips-for-running-in-production"},"Tips for running in production"),(0,r.kt)("p",null,"There are some things not covered in this guide needed to run ",(0,r.kt)("em",{parentName:"p"},"Sofie")," in a production environment:"),(0,r.kt)("ul",null,(0,r.kt)("li",{parentName:"ul"},"Logging: Collect, store and track error messages. ",(0,r.kt)("a",{parentName:"li",href:"https://www.elastic.co/kibana"},"Kibana")," and ",(0,r.kt)("a",{parentName:"li",href:"https://www.elastic.co/logstash"},"logstash")," is one way to do it."),(0,r.kt)("li",{parentName:"ul"},"NGINX: It is customary to put a load-balancer in front of ",(0,r.kt)("em",{parentName:"li"},"Sofie","\xa0","Core"),"."),(0,r.kt)("li",{parentName:"ul"},"Memory and CPU usage monitoring.")),(0,r.kt)("h2",{id:"installing-for-development"},"Installing for Development"),(0,r.kt)("p",null,"Installation instructions for installing Sofie-Core or the various gateways are available in the README file in their respective github repos."),(0,r.kt)("p",null,"Common prerequisites are ",(0,r.kt)("a",{parentName:"p",href:"https://nodejs.org/"},"Node.js")," and ",(0,r.kt)("a",{parentName:"p",href:"https://yarnpkg.com/"},"Yarn"),".",(0,r.kt)("br",{parentName:"p"}),"\n","Links to the repos are listed at ",(0,r.kt)("a",{parentName:"p",href:"../../for-developers/libraries"},"Applications & Libraries"),"."),(0,r.kt)("p",null,(0,r.kt)("a",{parentName:"p",href:"https://github.com/nrkno/sofie-core"},(0,r.kt)("em",{parentName:"a"},"Sofie","\xa0","Core")," GitHub Page for Developers")))}u.isMDXComponent=!0},5318:(e,t,n)=>{n.d(t,{Zo:()=>d,kt:()=>f});var o=n(7378);function r(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function a(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);t&&(o=o.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,o)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?a(Object(n),!0).forEach((function(t){r(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):a(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,o,r=function(e,t){if(null==e)return{};var n,o,r={},a=Object.keys(e);for(o=0;o<a.length;o++)n=a[o],t.indexOf(n)>=0||(r[n]=e[n]);return r}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(o=0;o<a.length;o++)n=a[o],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(r[n]=e[n])}return r}var l=o.createContext({}),p=function(e){var t=o.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},d=function(e){var t=p(e.components);return o.createElement(l.Provider,{value:t},e.children)},c="mdxType",u={inlineCode:"code",wrapper:function(e){var t=e.children;return o.createElement(o.Fragment,{},t)}},m=o.forwardRef((function(e,t){var n=e.components,r=e.mdxType,a=e.originalType,l=e.parentName,d=s(e,["components","mdxType","originalType","parentName"]),c=p(n),m=r,f=c["".concat(l,".").concat(m)]||c[m]||u[m]||a;return n?o.createElement(f,i(i({ref:t},d),{},{components:n})):o.createElement(f,i({ref:t},d))}));function f(e,t){var n=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var a=n.length,i=new Array(a);i[0]=m;var s={};for(var l in t)hasOwnProperty.call(t,l)&&(s[l]=t[l]);s.originalType=e,s[c]="string"==typeof e?e:r,i[1]=s;for(var p=2;p<a;p++)i[p]=n[p];return o.createElement.apply(null,i)}return o.createElement.apply(null,n)}m.displayName="MDXCreateElement"}}]);