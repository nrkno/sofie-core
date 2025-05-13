---
sidebar_position: 2
---

# Quick install

## Installing for testing \(or production\)

### **Prerequisites**

**\(Linux\)** Install [Docker](https://docs.docker.com/install/linux/docker-ce/ubuntu/) and [docker-compose](https://www.digitalocean.com/community/tutorials/how-to-install-docker-compose-on-ubuntu-18-04).  
**\(Windows\)** Install [Docker for Windows](https://hub.docker.com/editions/community/docker-ce-desktop-windows).

### Installation

This docker-compose file automates the basic setup of the [Sofie-Core application](../../for-developers/libraries.md#main-application), the backend database and different Gateway options.

```yaml
# This is NOT recommended to be used for a production deployment.
# It aims to quickly get an evaluation version of Sofie running and serve as a basis for how to set up a production deployment.
services:
  db:
    hostname: mongo
    image: mongo:6.0
    restart: always
    entrypoint: ['/usr/bin/mongod', '--replSet', 'rs0', '--bind_ip_all']
    # the healthcheck avoids the need to initiate the replica set
    healthcheck:
      test: test $$(mongosh --quiet --eval "try {rs.initiate()} catch(e) {rs.status().ok}") -eq 1
      interval: 10s
      start_period: 30s
    ports:
      - '27017:27017'
    volumes:
      - db-data:/data/db
    networks:
      - sofie

  core:
    hostname: core
    image: sofietv/tv-automation-server-core:release51
    restart: always
    ports:
      - '3000:3000' # Same port as meteor uses by default
    environment:
      PORT: '3000'
      MONGO_URL: 'mongodb://db:27017/meteor'
      MONGO_OPLOG_URL: 'mongodb://db:27017/local'
      ROOT_URL: 'http://localhost:3000'
      SOFIE_STORE_PATH: '/mnt/sofie-store'
    networks:
      - sofie
    volumes:
      - sofie-store:/mnt/sofie-store
    depends_on:
      - db

  playout-gateway:
    image: sofietv/tv-automation-playout-gateway:release51
    restart: always
    environment:
      DEVICE_ID: playoutGateway0
      CORE_HOST: core
      CORE_PORT: '3000'
    networks:
      - sofie
      - lan_access
    depends_on:
      - core

  # Choose one of the following images, depending on which type of ingest gateway is wanted.
  # If using the Rundown Editor, then none of the below images are needed.
  # The Rundown Editor can be found here: https://github.com/SuperFlyTV/sofie-automation-rundown-editor

  spreadsheet-gateway:
    image: superflytv/sofie-spreadsheet-gateway:latest
    restart: always
    command: yarn start -host core -port 3000 -id spreadsheetGateway0
    networks:
      - sofie
    depends_on:
      - core
    profiles: [spreadsheet-gateway]

  mos-gateway:
    image: sofietv/tv-automation-mos-gateway:release51
    restart: always
    ports:
      - "10540:10540" # MOS Lower port
      - "10541:10541" # MOS Upper port
      # - "10542:10542" # MOS query port - not used
    command: yarn start -host core -port 3000 -id mosGateway0
    networks:
      - sofie
    depends_on:
      - core
    profiles: [mos-gateway]

  inews-gateway:
    image: tv2media/inews-ftp-gateway:1.37.0-in-testing.20
    restart: always
    command: yarn start -host core -port 3000 -id inewsGateway0
    networks:
      - sofie
    depends_on:
      - core
    profiles: [inews-gateway]

networks:
  sofie:
  lan_access:
    driver: bridge

volumes:
  db-data:
  sofie-store:
```

Create a `Sofie` folder, copy the above content, and save it as `docker-compose.yaml` within the `Sofie` folder.

Once the installation is done, Sofie should be running on [http://localhost:3000](http://localhost:3000)

You can now choose if you are using the [Rundown Editor](rundown-editor.md) or an _ingest-gateway_. Visit [Rundowns & Newsroom Systems](installing-a-gateway/rundown-or-newsroom-system-connection/intro.md) to see which _Ingest Gateway_ is best suited for _your_ production environment.

Select the ingest gateway by creating using docker compose profiles. Create a file called `.env` in the same folder as docker compose with the contents:

```
COMPOSE_PROFILES=ingest-profile-name
```

But replacing `ingest-profile-name` with one of `spreadsheet-gateway`, `mos-gateway` or `inews-gateway`, or a comma separated list of more than one. For more information, see the [docker documentation on Compose profiles](https://docs.docker.com/compose/how-tos/profiles/).

Then open a terminal, `cd your-sofie-folder` and `sudo docker-compose up` \(just `docker-compose up` on Windows or MacOS\).

### Tips for running in production

There are some things not covered in this guide needed to run _Sofie_ in a production environment:

- Logging: Collect, store and track error messages. [Kibana](https://www.elastic.co/kibana) and [logstash](https://www.elastic.co/logstash) is one way to do it.
- NGINX: It is customary to put a load-balancer in front of _Sofie&nbsp;Core_.
- Memory and CPU usage monitoring.

## Installing for Development

Installation instructions for installing Sofie-Core or the various gateways are available in the README file in their respective github repos.

Common prerequisites are [Node.js](https://nodejs.org/) and [Yarn](https://yarnpkg.com/).  
Links to the repos are listed at [Applications & Libraries](../../for-developers/libraries.md).

[_Sofie&nbsp;Core_ GitHub Page for Developers](https://github.com/nrkno/sofie-core)
