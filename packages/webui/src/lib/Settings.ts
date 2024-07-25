import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { KeyboardLayouts } from './KeyboardLayout'

/**
 * This is an object specifying installation-wide, User Interface settings.
 * There are default values for these settings that will be used, unless overriden
 * through Meteor.settings functionality.
 *
 * You can use METEOR_SETTING to inject the settings JSON or you can use the
 * --settings [filename] to provide a JSON file containing the settings
 */
export interface ISettings {
	/* Should the segment in the Rundown view automatically rewind after it stops being live? Default: false */
	autoRewindLeavingSegment: boolean
	/** Disable blur border in RundownView */
	disableBlurBorder: boolean
	/** Default time scale zooming for the UI. Default: 1  */
	defaultTimeScale: number
	// Allow grabbing the entire timeline
	allowGrabbingTimeline: boolean
	/** If true, enables security measures, access control and user accounts. */
	enableUserAccounts: boolean
	/** Default duration to use to render parts when no duration is provided */
	defaultDisplayDuration: number
	/** If true, allows creation of new playlists in the Lobby Gui (rundown list). If false; only pre-existing playlists are allowed. */
	allowMultiplePlaylistsInGUI: boolean
	/** How many segments of history to show when scrolling back in time (0 = show current segment only) */
	followOnAirSegmentsHistory: number
	/** Clean up stuff that are older than this [ms] */
	maximumDataAge: number
	/** Enable the use of poison key if present and use the key specified. **/
	poisonKey: string | null
	/** If set, enables a check to ensure that the system time doesn't differ too much from the speficied NTP server time. */
	enableNTPTimeChecker: null | {
		host: string
		port?: number
		maxAllowedDiff: number
	}
	/** Default value used to toggle Shelf options when the 'display' URL argument is not provided. */
	defaultShelfDisplayOptions: string

	/** The KeyboardPreview is a feature that is not implemented in the main Fork, and is kept here for compatibility */
	enableKeyboardPreview: boolean

	/** Keyboard map layout (what physical layout to use for the keyboard) */
	keyboardMapLayout: KeyboardLayouts.Names

	/**
	 * CSS class applied to the body of the page. Used to include custom implementations that differ from the main Fork.
	 * I.e. custom CSS etc. Leave undefined if no custom implementation is needed
	 * */
	customizationClassName?: string

	/** If true, countdowns of videos will count down to the last freeze-frame of the video instead of to the end of the video */
	useCountdownToFreezeFrame: boolean

	/**
	 * Which keyboard key is used as "Confirm" in modal dialogs etc.
	 * In some installations, the rightmost Enter key (on the numpad) is dedicated for playout,
	 * in such cases this must be set to 'Enter' to exclude it.
	 */
	confirmKeyCode: 'Enter' | 'AnyEnter'
}

/**
 * Default values for Settings
 */
const DEFAULT_SETTINGS = Object.freeze<ISettings>({
	autoRewindLeavingSegment: true,
	disableBlurBorder: false,
	defaultTimeScale: 1,
	allowGrabbingTimeline: true,
	enableUserAccounts: false,
	defaultDisplayDuration: 3000,
	allowMultiplePlaylistsInGUI: false,
	poisonKey: 'Escape',
	followOnAirSegmentsHistory: 0,
	maximumDataAge: 1000 * 60 * 60 * 24 * 100, // 100 days
	enableNTPTimeChecker: null,
	defaultShelfDisplayOptions: 'buckets,layout,shelfLayout,inspector',
	enableKeyboardPreview: false,
	keyboardMapLayout: KeyboardLayouts.Names.STANDARD_102_TKL,
	useCountdownToFreezeFrame: true,
	confirmKeyCode: 'Enter',
})

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
})
