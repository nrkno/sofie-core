import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { KeyboardLayouts } from './keyboardLayout'

/**
 * This is an object specifying installation-wide, User Interface settings.
 * There are default values for these settings that will be used, unless overriden
 * through Meteor.settings functionality.
 *
 * You can use METEOR_SETTING to inject the settings JSON or you can use the
 * --settings [filename] to provide a JSON file containing the settings
 */
export interface ISettings {
	/** The framerate (frames per second) used to convert internal timing information (in milliseconds)
	 * into timecodes and timecode-like strings and interpret timecode user input
	 * Default: 25
	 */
	frameRate: number
	/** Should the Rundown view User Interface default all segments to "collapsed" state? Default: false */
	defaultToCollapsedSegments: boolean
	/* Should the segment in the Rundown view automatically rewind after it stops being live? Default: false */
	autoRewindLeavingSegment: boolean
	/** Should the Current and Next segments be automatically made expanded (uncollapsed)? Default: false */
	autoExpandCurrentNextSegment: boolean
	/** Disable blur border in RundownView */
	disableBlurBorder: boolean
	/** Default time scale zooming for the UI. Default: 1  */
	defaultTimeScale: number
	// Allow grabbing the entire timeline
	allowGrabbingTimeline: boolean
	/** Allow Segments to become unsynced, rather than the entire rundown */
	allowUnsyncedSegments: boolean
	/** Default duration to use to render parts when no duration is provided */
	defaultDisplayDuration: number
	/** Allow resets while a rundown is on-air */
	allowRundownResetOnAir: boolean
	// Show keyboard map in AdLib Shelf
	showKeyboardMap: boolean
	// Keyboard map layout (what physical layout to use for the keyboard)
	keyboardMapLayout: KeyboardLayouts.Names
	/** NRCS name displayed in various places */
	nrcsName: string
}

export let Settings: ISettings

/**
 * Default values for Settings
 */
const DEFAULT_SETTINGS: ISettings = {
	frameRate: 25,
	defaultToCollapsedSegments: false,
	autoExpandCurrentNextSegment: false,
	autoRewindLeavingSegment: false,
	disableBlurBorder: false,
	defaultTimeScale: 1,
	allowGrabbingTimeline: true,
	allowUnsyncedSegments: false,
	defaultDisplayDuration: 3000,
	allowRundownResetOnAir: false,
	showKeyboardMap: true,
	keyboardMapLayout: KeyboardLayouts.Names.STANDARD_102_TKL,
	nrcsName: 'ENPS',
}

Settings = _.clone(DEFAULT_SETTINGS)

Meteor.startup(() => {
	Settings = _.extend(Settings, Meteor.settings.public)
})
