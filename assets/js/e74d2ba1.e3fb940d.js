"use strict";(self.webpackChunksofie_documentation=self.webpackChunksofie_documentation||[]).push([[3685],{79207:(e,n,o)=>{o.r(n),o.d(n,{assets:()=>l,contentTitle:()=>r,default:()=>h,frontMatter:()=>i,metadata:()=>a,toc:()=>d});var t=o(62540),s=o(43023);const i={sidebar_position:2},r="Quick install",a={id:"user-guide/installation/installing-sofie-server-core",title:"Quick install",description:"Installing for testing \\(or production\\)",source:"@site/versioned_docs/version-1.37.0/user-guide/installation/installing-sofie-server-core.md",sourceDirName:"user-guide/installation",slug:"/user-guide/installation/installing-sofie-server-core",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/installing-sofie-server-core",draft:!1,unlisted:!1,editUrl:"https://github.com/nrkno/sofie-core/edit/master/packages/documentation/versioned_docs/version-1.37.0/user-guide/installation/installing-sofie-server-core.md",tags:[],version:"1.37.0",sidebarPosition:2,frontMatter:{sidebar_position:2},sidebar:"gettingStarted",previous:{title:"Getting Started",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/intro"},next:{title:"Initial Sofie Core Setup",permalink:"/sofie-core/docs/1.37.0/user-guide/installation/initial-sofie-core-setup"}},l={},d=[{value:"Installing for testing (or production)",id:"installing-for-testing-or-production",level:2},{value:"<strong>Prerequisites</strong>",id:"prerequisites",level:3},{value:"Installation",id:"installation",level:3},{value:"Tips for running in production",id:"tips-for-running-in-production",level:3},{value:"Installing for Development",id:"installing-for-development",level:2}];function c(e){const n={a:"a",br:"br",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,s.R)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:"quick-install",children:"Quick install"}),"\n",(0,t.jsx)(n.h2,{id:"installing-for-testing-or-production",children:"Installing for testing (or production)"}),"\n",(0,t.jsx)(n.h3,{id:"prerequisites",children:(0,t.jsx)(n.strong,{children:"Prerequisites"})}),"\n",(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:"(Linux)"})," Install ",(0,t.jsx)(n.a,{href:"https://docs.docker.com/install/linux/docker-ce/ubuntu/",children:"Docker"})," and ",(0,t.jsx)(n.a,{href:"https://www.digitalocean.com/community/tutorials/how-to-install-docker-compose-on-ubuntu-18-04",children:"docker-compose"}),".",(0,t.jsx)(n.br,{}),"\n",(0,t.jsx)(n.strong,{children:"(Windows)"})," Install ",(0,t.jsx)(n.a,{href:"https://hub.docker.com/editions/community/docker-ce-desktop-windows",children:"Docker for Windows"}),"."]}),"\n",(0,t.jsx)(n.h3,{id:"installation",children:"Installation"}),"\n",(0,t.jsxs)(n.p,{children:["This docker-compose file automates the basic setup of the ",(0,t.jsx)(n.a,{href:"../../for-developers/libraries#main-application",children:"Sofie-Core application"}),", the backend database and different Gateway options."]}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-yaml",children:"# This is NOT recommended to be used for a production deployment.\n# It aims to quickly get an evaluation version of Sofie running and serve as a basis for how to set up a production deployment.\nversion: '3.3'\nservices:\n  db:\n    hostname: mongo\n    image: mongo:4.2.18\n    restart: always\n    entrypoint: ['/usr/bin/mongod', '--replSet', 'rs0', '--bind_ip_all']\n    # the healthcheck avoids the need to initiate the replica set\n    healthcheck:\n      test: test $$(echo \"rs.initiate().ok || rs.status().ok\" | mongo --quiet) -eq 1\n      interval: 10s\n      start_period: 30s\n    ports:\n      - '27017:27017'\n    volumes:\n      - db-data:/data/db\n    networks:\n      - sofie\n\n  core:\n    hostname: core\n    image: sofietv/tv-automation-server-core:release37\n    restart: always\n    ports:\n      - '3000:3000' # Same port as meteor uses by default\n    environment:\n      PORT: '3000'\n      MONGO_URL: 'mongodb://db:27017/meteor'\n      MONGO_OPLOG_URL: 'mongodb://db:27017/local'\n      ROOT_URL: 'http://localhost:3000'\n    networks:\n      - sofie\n    volumes:\n      - snapshots:/mnt/snapshots\n    depends_on:\n      - db\n\n  playout-gateway:\n    image: sofietv/tv-automation-playout-gateway:release37\n    restart: always\n    command: yarn start -host core -port 3000 -id playoutGateway0\n    networks:\n      - sofie\n      - lan_access\n    depends_on:\n      - core\n\n  # Choose one of the following images, depending on which type of ingest gateway is wanted.\n  # If using the Rundown Editor, then none of the below images are needed.\n  # The Rundown Editor can be found here: https://github.com/SuperFlyTV/sofie-automation-rundown-editor\n\n  # spreadsheet-gateway:\n  #   image: superflytv/sofie-spreadsheet-gateway:latest\n  #   restart: always\n  #   command: yarn start -host core -port 3000 -id spreadsheetGateway0\n  #   networks:\n  #     - sofie\n  #   depends_on:\n  #     - core\n\n  # mos-gateway:\n  #   image: sofietv/tv-automation-mos-gateway:release37\n  #   restart: always\n  #   ports:\n  #     - \"10540:10540\" # MOS Lower port\n  #     - \"10541:10541\" # MOS Upper port\n  #     # - \"10542:10542\" # MOS query port - not used\n  #   command: yarn start -host core -port 3000 -id mosGateway0\n  #   networks:\n  #     - sofie\n  #   depends_on:\n  #     - core\n\n  # inews-gateway:\n  #   image: tv2media/inews-ftp-gateway:1.37.0-in-testing.20\n  #   restart: always\n  #   command: yarn start -host core -port 3000 -id inewsGateway0\n  #   networks:\n  #     - sofie\n  #   depends_on:\n  #     - core\n\nnetworks:\n  sofie:\n  lan_access:\n    driver: bridge\n\nvolumes:\n  db-data:\n  snapshots:\n"})}),"\n",(0,t.jsxs)(n.p,{children:["Create a ",(0,t.jsx)(n.code,{children:"Sofie"})," folder, copy the above content, and save it as ",(0,t.jsx)(n.code,{children:"docker-compose.yaml"})," within the ",(0,t.jsx)(n.code,{children:"Sofie"})," folder."]}),"\n",(0,t.jsxs)(n.p,{children:["Navigate to the ",(0,t.jsx)(n.em,{children:"ingest-gateway"})," section of ",(0,t.jsx)(n.code,{children:"docker-compose.yaml"})," and select which type of ",(0,t.jsx)(n.em,{children:"ingest-gateway"})," you'd like installed by uncommenting it. Save your changes. If you are using the ",(0,t.jsx)(n.a,{href:"rundown-editor",children:"Rundown Editor"}),", then no ingest gateways need to be uncommented."]}),"\n",(0,t.jsxs)(n.p,{children:["Then open a terminal, ",(0,t.jsx)(n.code,{children:"cd your-sofie-folder"})," and ",(0,t.jsx)(n.code,{children:"sudo docker-compose up"})," (just ",(0,t.jsx)(n.code,{children:"docker-compose up"})," on Windows)."]}),"\n",(0,t.jsxs)(n.p,{children:["Once the installation is done, Sofie should be running on ",(0,t.jsx)(n.a,{href:"http://localhost:3000",children:"http://localhost:3000"})]}),"\n",(0,t.jsxs)(n.p,{children:["Next, you will need to install a Rundown Gateway. Visit ",(0,t.jsx)(n.a,{href:"installing-a-gateway/rundown-or-newsroom-system-connection/intro",children:"Rundowns\xa0&\xa0Newsroom Systems"})," to see which ",(0,t.jsx)(n.em,{children:"Rundown Gateway"})," is best suited for ",(0,t.jsx)(n.em,{children:"your"})," production environment."]}),"\n",(0,t.jsx)(n.h3,{id:"tips-for-running-in-production",children:"Tips for running in production"}),"\n",(0,t.jsxs)(n.p,{children:["There are some things not covered in this guide needed to run ",(0,t.jsx)(n.em,{children:"Sofie"})," in a production environment:"]}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:["Logging: Collect, store and track error messages. ",(0,t.jsx)(n.a,{href:"https://www.elastic.co/kibana",children:"Kibana"})," and ",(0,t.jsx)(n.a,{href:"https://www.elastic.co/logstash",children:"logstash"})," is one way to do it."]}),"\n",(0,t.jsxs)(n.li,{children:["NGINX: It is customary to put a load-balancer in front of ",(0,t.jsx)(n.em,{children:"Sofie\xa0Core"}),"."]}),"\n",(0,t.jsx)(n.li,{children:"Memory and CPU usage monitoring."}),"\n"]}),"\n",(0,t.jsx)(n.h2,{id:"installing-for-development",children:"Installing for Development"}),"\n",(0,t.jsx)(n.p,{children:"Installation instructions for installing Sofie-Core or the various gateways are available in the README file in their respective github repos."}),"\n",(0,t.jsxs)(n.p,{children:["Common prerequisites are ",(0,t.jsx)(n.a,{href:"https://nodejs.org/",children:"Node.js"})," and ",(0,t.jsx)(n.a,{href:"https://yarnpkg.com/",children:"Yarn"}),".",(0,t.jsx)(n.br,{}),"\n","Links to the repos are listed at ",(0,t.jsx)(n.a,{href:"../../for-developers/libraries",children:"Applications & Libraries"}),"."]}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsxs)(n.a,{href:"https://github.com/nrkno/sofie-core",children:[(0,t.jsx)(n.em,{children:"Sofie\xa0Core"})," GitHub Page for Developers"]})})]})}function h(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(c,{...e})}):c(e)}},43023:(e,n,o)=>{o.d(n,{R:()=>r,x:()=>a});var t=o(63696);const s={},i=t.createContext(s);function r(e){const n=t.useContext(i);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function a(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:r(e.components),t.createElement(i.Provider,{value:n},e.children)}}}]);