# syntax=docker/dockerfile:experimental
# BUILD IMAGE
FROM node:12.12.0
WORKDIR /opt/mos-gateway
COPY . .
RUN yarn install --check-files --frozen-lockfile
RUN yarn build
RUN yarn install --check-files --frozen-lockfile --production --force # purge dev-dependencies

# DEPLOY IMAGE
FROM node:12.12.0-alpine
RUN apk add --no-cache tzdata
COPY --from=0 /opt/mos-gateway /opt/mos-gateway
WORKDIR /opt/mos-gateway
CMD ["yarn", "start"]
