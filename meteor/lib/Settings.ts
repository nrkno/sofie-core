import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { ISettings, DEFAULT_SETTINGS } from '@sofie-automation/corelib/dist/settings'

export { ISettings, DEFAULT_SETTINGS }

/**
 * This is an object specifying installation-wide, User Interface settings.
 * There are default values for these settings that will be used, unless overriden
 * through Meteor.settings functionality.
 *
 * You can use METEOR_SETTING to inject the settings JSON or you can use the
 * --settings [filename] to provide a JSON file containing the settings
 */
export let Settings: ISettings

Settings = _.clone(DEFAULT_SETTINGS)

Meteor.startup(() => {
	Settings = _.extend(Settings, Meteor.settings.public)

	// Translate old Settings names which solve a similar problem but with a different approach
	const settingsOld = Settings
	if ('allowUnsyncedSegments' in settingsOld && settingsOld['preserveUnsyncedPlayingSegmentContents']) {
		Settings.preserveUnsyncedPlayingSegmentContents = settingsOld['preserveUnsyncedPlayingSegmentContents']
	}
})
