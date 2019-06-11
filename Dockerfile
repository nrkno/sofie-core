# syntax=docker/dockerfile:experimental
# BUILD IMAGE
FROM node:8.11.4
RUN curl https://install.meteor.com/ | sh
COPY meteor /opt/core/meteor
WORKDIR /opt/core/meteor
# Temporary change the NODE_ENV env variable, so that all libraries are installed:
ENV NODE_ENV_TMP $NODE_ENV
ENV NODE_ENV anythingButProduction
RUN meteor npm install
# Restore the NODE_ENV variable:
ENV NODE_ENV $NODE_ENV_TMP
RUN --mount=type=cache,target=/opt/core/meteor/.meteor/local NODE_OPTIONS="--max-old-space-size=8192" METEOR_DEBUG_BUILD=1 meteor build --allow-superuser --directory /opt/
WORKDIR /opt/bundle/programs/server/
RUN npm install

# DEPLOY IMAGE
FROM node:8.11.4-slim
COPY --from=0 /opt/bundle /opt/core
WORKDIR /opt/core/
CMD ["node", "main.js"]
