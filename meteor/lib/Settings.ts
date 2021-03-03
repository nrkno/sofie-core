import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'

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
	/** If true, enables security measures, access control and user accounts. */
	enableUserAccounts: boolean
	/** Allow Segments to become unsynced, rather than the entire rundown */
	allowUnsyncedSegments: boolean
	/** Allow resets while a rundown is on-air */
	allowRundownResetOnAir: boolean
	/** Default duration to use to render parts when no duration is provided */
	defaultDisplayDuration: number
	/** If true, allows creation of new playlists in the Lobby Gui (rundown list). If false; only pre-existing playlists are allowed. */
	allowMultiplePlaylistsInGUI: boolean
	/** How many segments of history to show when scrolling back in time (0 = show current segment only) */
	followOnAirSegmentsHistory: number
}

export let Settings: ISettings

/**
 * Default values for Settings
 */
const DEFAULT_SETTINGS: ISettings = {
	frameRate: 25,
	defaultToCollapsedSegments: false,
	autoExpandCurrentNextSegment: false,
	autoRewindLeavingSegment: true,
	disableBlurBorder: false,
	defaultTimeScale: 1,
	allowGrabbingTimeline: true,
	enableUserAccounts: false,
	allowUnsyncedSegments: false,
	allowRundownResetOnAir: false,
	defaultDisplayDuration: 3000,
	allowMultiplePlaylistsInGUI: false,
	followOnAirSegmentsHistory: 0,
}

Settings = _.clone(DEFAULT_SETTINGS)

Meteor.startup(() => {
	Settings = _.extend(Settings, Meteor.settings.public)
})
