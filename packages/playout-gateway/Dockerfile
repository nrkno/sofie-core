# syntax=docker/dockerfile:experimental
# BUILD IMAGE
FROM node:18
WORKDIR /opt

COPY . .

RUN corepack enable
RUN yarn install --immutable
RUN yarn run pinst --disable
RUN yarn lerna run --scope \*\*/playout-gateway --include-dependencies --stream build
RUN yarn plugin import workspace-tools
RUN yarn workspaces focus --all --production # purge dev-dependencies

# DEPLOY IMAGE
FROM node:18-alpine
RUN apk add --no-cache tzdata

COPY --from=0 /opt/package.json /opt/package.json
COPY --from=0 /opt/node_modules /opt/node_modules
COPY --from=0 /opt/playout-gateway /opt/playout-gateway
COPY --from=0 /opt/server-core-integration /opt/server-core-integration
COPY --from=0 /opt/shared-lib /opt/shared-lib

WORKDIR /opt/playout-gateway
CMD ["node", "dist/index.js"]
