# syntax=docker/dockerfile:experimental
# BUILD IMAGE
FROM node:16.16
WORKDIR /opt

COPY package.json lerna.json yarn.lock tsconfig.json ./
COPY mos-gateway mos-gateway
COPY server-core-integration server-core-integration
COPY shared-lib shared-lib

RUN yarn install --check-files --frozen-lockfile
RUN yarn build
RUN yarn install --check-files --frozen-lockfile --production --force --ignore-scripts # purge dev-dependencies

# DEPLOY IMAGE
FROM node:16.16-alpine
RUN apk add --no-cache tzdata

COPY --from=0 /opt/package.json /opt/package.json
COPY --from=0 /opt/node_modules /opt/node_modules
COPY --from=0 /opt/mos-gateway /opt/mos-gateway
COPY --from=0 /opt/server-core-integration /opt/server-core-integration
COPY --from=0 /opt/shared-lib /opt/shared-lib

WORKDIR /opt/mos-gateway
CMD ["yarn", "start"]
