import { IBlueprintPartInstance, IBlueprintPartInstanceTimings, Time } from '@sofie-automation/blueprints-integration'
import { PartCalculatedTimings } from '../playout/timings'
import { ProtectedStringProperties } from '../protectedString'
import { PartInstanceId, RundownId, RundownPlaylistActivationId, SegmentId, SegmentPlayoutId } from './Ids'
import { DBPart } from './Part'

export interface InternalIBlueprintPartInstance
	extends ProtectedStringProperties<Omit<IBlueprintPartInstance, 'part'>, '_id' | 'segmentId'> {
	part: ProtectedStringProperties<IBlueprintPartInstance['part'], '_id' | 'segmentId'>
}

export interface DBPartInstance extends InternalIBlueprintPartInstance {
	_id: PartInstanceId
	rundownId: RundownId
	segmentId: SegmentId

	/** The id of the playlist activation session */
	playlistActivationId: RundownPlaylistActivationId
	/** The id of the segment playout. This is unique for each session, and each time the segment is entered  */
	segmentPlayoutId: SegmentPlayoutId

	/** Whether this instance has been finished with and reset (to restore the original part as the primary version) */
	reset?: boolean

	/** Rank of the take that this PartInstance belongs to */
	takeCount: number

	/** Temporarily track whether this PartInstance has been taken, so we can easily find and prune those which are only nexted */
	isTaken?: boolean

	/** Playout timings, in here we log times when playout happens */
	timings?: PartInstanceTimings

	part: DBPart

	/** Once taken, we should have timings for how the part interacts with the one before */
	partPlayoutTimings?: PartCalculatedTimings
}

export interface PartInstanceTimings extends IBlueprintPartInstanceTimings {
	/** The playback offset that was set for the last take */
	playOffset?: Time
	/**
	 * The duration this part was playing for.
	 * This is set when the next part has started playback
	 */
	duration?: Time

	/** Point in time the Part was taken, (ie the time of the user action) */
	take?: Time

	/** Point in time that this Part was set as next */
	setAsNext?: Time

	/**
	 * Point in time where the Part is planned to start playing.
	 * This gets set when the part is taken
	 * It may get set to a point in the past, if an offset is chosen when starting to play the part
	 */
	plannedStartedPlayback?: Time
	/**
	 * Point in time whre the Part is planned to stop playing
	 * This gets set when the plannedStartedPlayback of the following part is set
	 */
	plannedStoppedPlayback?: Time
}
