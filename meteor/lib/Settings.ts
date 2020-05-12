import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { KeyboardLayouts } from './keyboardLayout'

export interface ISettings {
	frameRate: number,
	defaultToCollapsedSegments: boolean,
	autoExpandCurrentNextSegment: boolean,
	autoRewindLeavingSegment: boolean,
	defaultTimeScale: number
	defaultDisplayDuration: number
	/** Wether to enable unsyncing of segements in case a data-update is rejected. Default functionality is to just unsync the whole rundown */
	allowUnsyncedSegments: boolean
	// Allow grabbing the entire timeline
	allowGrabbingTimeline: boolean
	// Allow resets while a rundown is on-air
	allowUnsafeResets: boolean
	// Show keyboard map in AdLib Shelf
	showKeyboardMap: boolean
	// Keyboard map layout (what physical layout to use for the keyboard)
	keyboardMapLayout: KeyboardLayouts.Names
}

export let Settings: ISettings

const DEFAULT_SETTINGS: ISettings = {
	'frameRate': 25,
	'defaultToCollapsedSegments': false,
	'autoExpandCurrentNextSegment': false,
	'autoRewindLeavingSegment': false,
	'defaultTimeScale': 1,
	'defaultDisplayDuration': 3000,
	'allowUnsyncedSegments': true,
	'allowGrabbingTimeline': true,
	'allowUnsafeResets': false,
	'showKeyboardMap': true,
	'keyboardMapLayout': KeyboardLayouts.Names.STANDARD_102_TKL
}

Settings = _.clone(DEFAULT_SETTINGS)

Meteor.startup(() => {
	Settings = _.extend(Settings, Meteor.settings.public)
})
