#!/bin/bash

#rm ~/Projects/logstash-feed/server-core.log

# Read in settings file if it exists, and variable has not already been set
#SETTINGS_FILE=/opt/core-settings.json
#if [ -z ${METEOR_SETTINGS+x} ] && [ -f "$SETTINGS_FILE" ]; then
#	export METEOR_SETTINGS=$(cat $SETTINGS_FILE)
#	echo "found settings file"
#fi

# export APP_HOST=thinkpad
# export APM_HOST=https://apm.julus.uk:8200
# export APM_SECRET=45xDF61E03fqatZ2jIZ1XD49
#export KIBANA_INDEX=tv-automation-server-core
# export SERVER_NODE_OPTIONS=--expose_gc

export REDIS_URL=redis://localhost

export LOG_FILE=~/Projects/logstash-feed/server-core.log
export NTP_SERVERS=10.42.13.254

yarn start

