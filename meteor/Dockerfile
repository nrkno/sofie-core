# syntax=docker/dockerfile:experimental
# BUILD IMAGE
FROM node:14.19
RUN curl "https://install.meteor.com/?release=2.7.3" | sh
# Temporary change the NODE_ENV env variable, so that all libraries are installed:
ENV NODE_ENV_TMP $NODE_ENV
ENV NODE_ENV anythingButProduction
COPY packages /opt/core/packages
WORKDIR /opt/core/packages
RUN rm -R *-gateway documentation
RUN yarn install && yarn build
COPY meteor /opt/core/meteor
COPY scripts /opt/core/scripts
WORKDIR /opt/core/meteor
# Force meteor to setup the runtime
RUN meteor --version --allow-superuser
RUN meteor npm install -g yarn
RUN meteor yarn install
# Restore the NODE_ENV variable:
ENV NODE_ENV $NODE_ENV_TMP
RUN --mount=type=cache,target=/opt/core/meteor/.meteor/local NODE_OPTIONS="--max-old-space-size=4096" METEOR_DEBUG_BUILD=1 meteor build --allow-superuser --directory /opt/
WORKDIR /opt/bundle/programs/server/
RUN npm install
# Install production dependencies for the worker
WORKDIR /opt/core/packages
RUN yarn --prod --ignore-scripts

# DEPLOY IMAGE
FROM node:14.19-slim
COPY --from=0 /opt/bundle /opt/core
COPY --from=0 /opt/core/packages /opt/packages
COPY meteor/docker-entrypoint.sh /opt

# Tell meteor where the worker code is located
ENV WORKER_EXEC_DIR=/opt/packages/job-worker

WORKDIR /opt/core/
CMD ["/opt/docker-entrypoint.sh"]
