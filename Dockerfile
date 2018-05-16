# BUILD IMAGE
FROM node:8.11.1 AS build
RUN curl https://install.meteor.com/ | sh
COPY meteor /opt/core/meteor
WORKDIR /opt/core/meteor
RUN meteor npm install --production
RUN meteor build --allow-superuser --directory /opt/
WORKDIR /opt/bundle/programs/server/
RUN npm install

# DEPLOY IMAGE
FROM node:8.11.1-slim
COPY --from=build /opt/bundle /opt/core
WORKDIR /opt/core/
CMD ["node", "main.js"]
