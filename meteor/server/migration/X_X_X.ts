import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Studios } from '../../lib/collections/Studios'
import { Settings } from '../../lib/Settings'
import { Parts } from '../../lib/collections/Parts'
import { RundownBaselineObjs } from '../../lib/collections/RundownBaselineObjs'
import { serializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { Pieces } from '../../lib/collections/Pieces'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { BucketAdLibs } from '../../lib/collections/BucketAdlibs'
import { PieceInstances } from '../../lib/collections/PieceInstances'
import { RundownBaselineAdLibPieces } from '../../lib/collections/RundownBaselineAdLibPieces'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

interface ISettingsOld {
	/** The framerate (frames per second) used to convert internal timing information (in milliseconds)
	 * into timecodes and timecode-like strings and interpret timecode user input
	 * Default: 25
	 */
	frameRate: number
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
	/** Preserve unsynced segment contents when the playing segment is removed, rather than removing all but the playing part */
	preserveUnsyncedPlayingSegmentContents: boolean
	/** Allow resets while a rundown is on-air */
	allowRundownResetOnAir: boolean
	/** Default duration to use to render parts when no duration is provided */
	defaultDisplayDuration: number
	/** If true, allows creation of new playlists in the Lobby Gui (rundown list). If false; only pre-existing playlists are allowed. */
	allowMultiplePlaylistsInGUI: boolean
	/** How many segments of history to show when scrolling back in time (0 = show current segment only) */
	followOnAirSegmentsHistory: number
	/** Clean up stuff that are older than this [ms] */
	maximumDataAge: number

	/** If set, enables a check to ensure that the system time doesn't differ too much from the speficied NTP server time. */
	enableNTPTimeChecker: null | {
		host: string
		port?: number
		maxAllowedDiff: number
	}
}
const OldSettings = Settings as Partial<ISettingsOld>
const oldFrameRate = OldSettings.frameRate ?? 25

// Release X
export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	// Add some migrations!

	{
		id: `Studio.settings.frameRate`,
		canBeRunAutomatically: true,
		validate: () => {
			const count = Studios.find({
				'settings.frameRate': {
					$exists: false,
				},
			}).count()
			if (count > 0) return `${count} studios need to be updated`
			return false
		},
		migrate: () => {
			Studios.update(
				{
					'settings.frameRate': {
						$exists: false,
					},
				},
				{
					$set: {
						'settings.frameRate': oldFrameRate,
					},
				}
			)
		},
	},
	{
		id: `Studio.settings.preserveUnsyncedPlayingSegmentContents`,
		canBeRunAutomatically: true,
		validate: () => {
			if (OldSettings.preserveUnsyncedPlayingSegmentContents !== undefined) {
				const count = Studios.find({
					'settings.preserveUnsyncedPlayingSegmentContents': {
						$exists: false,
					},
				}).count()
				if (count > 0) return `${count} studios need to be updated`
			}
			return false
		},
		migrate: () => {
			if (OldSettings.preserveUnsyncedPlayingSegmentContents !== undefined) {
				Studios.update(
					{
						'settings.preserveUnsyncedPlayingSegmentContents': {
							$exists: false,
						},
					},
					{
						$set: {
							'settings.preserveUnsyncedPlayingSegmentContents':
								OldSettings.preserveUnsyncedPlayingSegmentContents,
						},
					}
				)
			}
		},
	},
	{
		id: `Studio.settings.allowRundownResetOnAir`,
		canBeRunAutomatically: true,
		validate: () => {
			if (OldSettings.allowRundownResetOnAir !== undefined) {
				const count = Studios.find({
					'settings.allowRundownResetOnAir': {
						$exists: false,
					},
				}).count()
				if (count > 0) return `${count} studios need to be updated`
			}
			return false
		},
		migrate: () => {
			if (OldSettings.allowRundownResetOnAir !== undefined) {
				Studios.update(
					{
						'settings.allowRundownResetOnAir': {
							$exists: false,
						},
					},
					{
						$set: {
							'settings.allowRundownResetOnAir': OldSettings.allowRundownResetOnAir,
						},
					}
				)
			}
		},
	},
	{
		id: `Parts.expectedDurationWithPreroll`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = Parts.find({
				expectedDurationWithPreroll: {
					$exists: false,
				},
			}).count()
			if (objects > 0) {
				return `timing is expectedDurationWithPreroll on ${objects} objects`
			}
			return false
		},
		migrate: () => {
			const objects = Parts.find({
				expectedDurationWithPreroll: {
					$exists: false,
				},
			}).fetch()
			for (const obj of objects) {
				Parts.update(obj._id, {
					$set: {
						expectedDurationWithPreroll: obj.expectedDuration,
					},
				})
			}
		},
	},

	{
		id: `RundownBaselineObj.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = RundownBaselineObjs.find({
				timelineObjects: { $exists: true },
			}).count()
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = RundownBaselineObjs.find({
				timelineObjects: { $exists: true },
			}).fetch()
			for (const obj of objects) {
				RundownBaselineObjs.update(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob((obj as any).timelineObjects),
					},
					$unset: {
						timelineObjects: 1,
					},
				})
			}
		},
	},
	{
		id: `Pieces.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = Pieces.find({
				'content.timelineObjects': { $exists: true },
			}).count()
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = Pieces.find({
				'content.timelineObjects': { $exists: true },
			}).fetch()
			for (const obj of objects) {
				Pieces.update(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob((obj as any).content.timelineObjects),
					},
					$unset: {
						'content.timelineObjects': 1,
					},
				})
			}
		},
	},
	{
		id: `AdLibPieces.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = AdLibPieces.find({
				'content.timelineObjects': { $exists: true },
			}).count()
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = AdLibPieces.find({
				'content.timelineObjects': { $exists: true },
			}).fetch()
			for (const obj of objects) {
				AdLibPieces.update(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob((obj as any).content.timelineObjects),
					},
					$unset: {
						'content.timelineObjects': 1,
					},
				})
			}
		},
	},
	{
		id: `RundownBaselineAdLibPieces.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = RundownBaselineAdLibPieces.find({
				'content.timelineObjects': { $exists: true },
			}).count()
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = RundownBaselineAdLibPieces.find({
				'content.timelineObjects': { $exists: true },
			}).fetch()
			for (const obj of objects) {
				RundownBaselineAdLibPieces.update(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob((obj as any).content.timelineObjects),
					},
					$unset: {
						'content.timelineObjects': 1,
					},
				})
			}
		},
	},
	{
		id: `BucketAdLibs.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = BucketAdLibs.find({
				'content.timelineObjects': { $exists: true },
			}).count()
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = BucketAdLibs.find({
				'content.timelineObjects': { $exists: true },
			}).fetch()
			for (const obj of objects) {
				BucketAdLibs.update(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob((obj as any).content.timelineObjects),
					},
					$unset: {
						'content.timelineObjects': 1,
					},
				})
			}
		},
	},
	{
		id: `PieceInstances.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = PieceInstances.find({
				'piece.content.timelineObjects': { $exists: true },
			}).count()
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = PieceInstances.find({
				'piece.content.timelineObjects': { $exists: true },
			}).fetch()
			for (const obj of objects) {
				PieceInstances.update(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob(
							(obj as any).piece.content.timelineObjects
						),
					},
					$unset: {
						'piece.content.timelineObjects': 1,
					},
				})
			}
		},
	},
])
