#!/bin/sh

# Read in settings file if it exists, and variable has not already been set
SETTINGS_FILE=/opt/core-settings.json
if [ -z ${METEOR_SETTINGS+x} ] && [ -f "$SETTINGS_FILE" ]; then
	export METEOR_SETTINGS="$(cat $SETTINGS_FILE)"
fi

# Start meteor
cd /opt/core
node --inspect=0.0.0.0:9229 main.js
