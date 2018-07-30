import * as _ from 'underscore'

const defaultSettings = require('./defaultSettings.json')
let localSettings = {}
try {
	localSettings = require('../settings.json')
} catch (e) {
	localSettings = {}
}

let localSettingsEnv = {}
function screamSnakeCase (input: string) {
	return input.replace(/([A-Z])/g, '_$1').toUpperCase()
}

try {
	_.keys(defaultSettings).forEach((setting) => {
		const envName = screamSnakeCase(setting)
		if (process.env[envName] !== undefined) localSettingsEnv[setting] = process.env[envName]
	})
} catch (e) {
	localSettingsEnv = {}
}

export const Settings = _.extend({}, defaultSettings, localSettings, localSettingsEnv)
