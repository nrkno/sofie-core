import * as _ from 'underscore'

const defaultSettings = require('./defaultSettings.json')
let localSettings
try {
	localSettings = require('../settings.json')
} catch (e) {
	localSettings = {}
}

export const Settings = _.extend({}, defaultSettings, localSettings)
