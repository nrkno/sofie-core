FROM docker.nrk.no/origo/node4_npm2:1.1.0

MAINTAINER Torstein Bjørnstad

WORKDIR /app
ADD package.json /app/package.json
ADD Gruntfile.js /app/Gruntfile.js
ADD node_modules /app/node_modules
ADD fonts /app/fonts
ADD images /app/images
ADD dist /app/dist
ADD scripts /app/scripts
ADD styleguide /app/styleguide
RUN ["/usr/bin/npm", "rebuild", "node-sass"]
RUN ["/usr/bin/npm", "install", "grunt-cli", "-g"]
CMD ["/usr/bin/npm", "run", "start-dist"]