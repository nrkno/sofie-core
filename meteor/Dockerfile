# syntax=docker/dockerfile:experimental
# BUILD IMAGE
FROM meteor/node:14.21.4
RUN curl "https://install.meteor.com/?release=2.13.3" | sh

# Temporary change the NODE_ENV env variable, so that all libraries are installed:
ENV NODE_ENV_TMP $NODE_ENV
ENV NODE_ENV anythingButProduction

# Prepare the packages
COPY package.json /opt/core/package.json
COPY packages /opt/core/packages
WORKDIR /opt/core/packages
RUN rm -R *-gateway documentation openapi
RUN corepack enable
RUN yarn install && yarn build

# Add the meteor source
COPY meteor /opt/core/meteor
COPY scripts /opt/core/scripts
WORKDIR /opt/core/meteor

# Force meteor to setup the runtime
RUN meteor --version --allow-superuser
RUN meteor corepack enable
RUN meteor yarn install

# Restore the NODE_ENV variable:
ENV NODE_ENV $NODE_ENV_TMP
RUN --mount=type=cache,target=/opt/core/meteor/.meteor/local NODE_OPTIONS="--max-old-space-size=4096" METEOR_DEBUG_BUILD=1 meteor build --allow-superuser --directory /opt/
WORKDIR /opt/bundle/programs/server/
RUN npm install

# DEPLOY IMAGE
FROM alpine:3.19

ENV NODE_VERSION=14.21.4
ENV NODE_URL="https://static.meteor.com/dev-bundle-node-os/unofficial-builds/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.gz"
ENV DIR_NODE=/usr/local

RUN apk add --no-cache \
    libstdc++ \
    && apk add --no-cache --virtual .build-deps-full \
    binutils-gold \
    curl \
    gnupg \
    xz

RUN echo $NODE_URL \
    && curl -sSL "$NODE_URL" | tar -xz -C /usr/local/ && mv $DIR_NODE/node-v${NODE_VERSION}-linux-x64 $DIR_NODE/v$NODE_VERSION

# add node and npm to path so the commands are available
ENV NODE_PATH $DIR_NODE/v$NODE_VERSION/lib/node_modules
ENV PATH $DIR_NODE/v$NODE_VERSION/bin:$PATH

# confirm installation
RUN node -v && npm -v

COPY --from=0 /opt/bundle /opt/core
COPY meteor/docker-entrypoint.sh /opt

# Tell meteor where the worker code is located
ENV WORKER_EXEC_DIR=/opt/packages/job-worker

WORKDIR /opt/core/
CMD ["/opt/docker-entrypoint.sh"]
