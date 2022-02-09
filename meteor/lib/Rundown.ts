import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { Pieces, Piece } from './collections/Pieces'
import { IOutputLayer, ISourceLayer, ITranslatableMessage } from '@sofie-automation/blueprints-integration'
import { DBSegment, Segment, SegmentId } from './collections/Segments'
import { PartId, DBPart } from './collections/Parts'
import { PartInstance, wrapPartToTemporaryInstance } from './collections/PartInstances'
import { PieceInstance, PieceInstances } from './collections/PieceInstances'
import {
	getPieceInstancesForPart,
	buildPiecesStartingInThisPartQuery,
	buildPastInfinitePiecesForThisPartQuery,
	PieceInstanceWithTimings,
} from './rundown/infinites'
import { FindOptions } from './typings/meteor'
import { invalidateAfter } from '../client/lib/invalidatingTime'
import { getCurrentTime, ProtectedString, protectString, unprotectString } from './lib'
import {
	RundownPlaylist,
	RundownPlaylistActivationId,
	RundownPlaylistCollectionUtil,
} from './collections/RundownPlaylists'
import { Rundown, RundownId } from './collections/Rundowns'
import { ShowStyleBaseId } from './collections/ShowStyleBases'
import { isTranslatableMessage } from './api/TranslatableMessage'

export interface SegmentExtended extends DBSegment {
	/** Output layers available in the installation used by this segment */
	outputLayers: {
		[key: string]: IOutputLayerExtended
	}
	/** Source layers used by this segment */
	sourceLayers: {
		[key: string]: ISourceLayerExtended
	}
}

export type PartInstanceLimited = Omit<PartInstance, 'isTaken' | 'previousPartEndState' | 'takeCount'>

export interface PartExtended {
	partId: PartId
	instance: PartInstanceLimited
	/** Pieces belonging to this part */
	pieces: Array<PieceExtended>
	renderedDuration: number
	startsAt: number
	willProbablyAutoNext: boolean
}

export interface IOutputLayerExtended extends IOutputLayer {
	/** Is this output layer used in this segment */
	used: boolean
	/** Source layers that will be used by this output layer */
	sourceLayers: Array<ISourceLayerExtended>
}
export interface ISourceLayerExtended extends ISourceLayer {
	/** Pieces present on this source layer */
	pieces: Array<PieceExtended>
	followingItems: Array<PieceExtended>
}
export interface PieceExtended {
	instance: PieceInstanceWithTimings

	/** Source layer that this piece belongs to */
	sourceLayer?: ISourceLayerExtended
	/** Output layer that this part uses */
	outputLayer?: IOutputLayerExtended
	/** Position in timeline, relative to the beginning of the Part */
	renderedInPoint: number | null
	/** Duration in timeline */
	renderedDuration: number | null
	/** If set, the item was cropped in runtime by another item following it */
	cropped?: boolean
	/** This item is being continued by another, linked, item in another Part */
	continuedByRef?: PieceExtended
	/** This item is continuing another, linked, item in another Part */
	continuesRef?: PieceExtended
	/** Maximum width of a label so as not to appear underneath the following item */
	maxLabelWidth?: number
	/** If this piece has a "buddy" piece in the preceeding part, then it's not neccessary to display it's left label */
	hasOriginInPreceedingPart?: boolean
}

export function fetchPiecesThatMayBeActiveForPart(
	part: DBPart,
	partsBeforeThisInSegmentSet: Set<PartId>,
	segmentsBeforeThisInRundownSet: Set<SegmentId>,
	rundownsBeforeThisInPlaylist: RundownId[]
): Piece[] {
	const piecesStartingInPart = Pieces.find(buildPiecesStartingInThisPartQuery(part)).fetch()

	const partsBeforeThisInSegment = Array.from(partsBeforeThisInSegmentSet.values())
	const segmentsBeforeThisInRundown = Array.from(segmentsBeforeThisInRundownSet.values())

	const infinitePieceQuery = buildPastInfinitePiecesForThisPartQuery(
		part,
		partsBeforeThisInSegment,
		segmentsBeforeThisInRundown,
		rundownsBeforeThisInPlaylist
	)
	const infinitePieces = infinitePieceQuery ? Pieces.find(infinitePieceQuery).fetch() : []

	return [...piecesStartingInPart, ...infinitePieces]
}

const SIMULATION_INVALIDATION = 3000

/**
 * Get the PieceInstances for a given PartInstance. Will create temporary PieceInstances, based on the Pieces collection
 * if the partInstance is temporary.
 *
 * @export
 * @param {PartInstanceLimited} partInstance
 * @param {Set<PartId>} partsBeforeThisInSegmentSet
 * @param {Set<SegmentId>} segmentsBeforeThisInRundownSet
 * @param {PartId[]} orderedAllParts
 * @param {boolean} nextPartIsAfterCurrentPart
 * @param {(PartInstance | undefined)} currentPartInstance
 * @param {(PieceInstance[] | undefined)} currentPartInstancePieceInstances
 * @param {FindOptions<PieceInstance>} [options]
 * @param {boolean} [pieceInstanceSimulation] If there are no PieceInstances in the PartInstance, create temporary
 * 		PieceInstances based on the Pieces collection and register a reactive dependancy to recalculate the current
 * 		computation after some time to return the actual PieceInstances for the PartInstance.
 * @return {*}
 */
export function getPieceInstancesForPartInstance(
	playlistActivationId: RundownPlaylistActivationId | undefined,
	rundown: Pick<Rundown, '_id' | 'showStyleBaseId'>,
	partInstance: PartInstanceLimited,
	partsBeforeThisInSegmentSet: Set<PartId>,
	segmentsBeforeThisInRundownSet: Set<SegmentId>,
	rundownsBeforeThisInPlaylist: RundownId[],
	rundownsToShowstyles: Map<RundownId, ShowStyleBaseId>,
	orderedAllParts: PartId[],
	nextPartIsAfterCurrentPart: boolean,
	currentPartInstance: PartInstance | undefined,
	currentPartInstancePieceInstances: PieceInstance[] | undefined,
	options?: FindOptions<PieceInstance>,
	pieceInstanceSimulation?: boolean
) {
	if (partInstance.isTemporary) {
		return getPieceInstancesForPart(
			playlistActivationId || protectString(''),
			currentPartInstance,
			currentPartInstancePieceInstances,
			rundown,
			partInstance.part,
			partsBeforeThisInSegmentSet,
			segmentsBeforeThisInRundownSet,
			rundownsBeforeThisInPlaylist,
			rundownsToShowstyles,
			fetchPiecesThatMayBeActiveForPart(
				partInstance.part,
				partsBeforeThisInSegmentSet,
				segmentsBeforeThisInRundownSet,
				rundownsBeforeThisInPlaylist
			),
			orderedAllParts,
			partInstance._id,
			nextPartIsAfterCurrentPart,
			partInstance.isTemporary
		)
	} else {
		const results =
			// Check if the PartInstance we're currently looking for PieceInstances for is already the current one.
			// If that's the case, we can sace ourselves a scan across the PieceInstances collection
			partInstance._id === currentPartInstance?._id && currentPartInstancePieceInstances
				? currentPartInstancePieceInstances
				: PieceInstances.find({ partInstanceId: partInstance._id }, options).fetch()
		// check if we can return the results immediately
		if (results.length > 0 || !pieceInstanceSimulation) return results

		// if a simulation has been requested and less than SIMULATION_INVALIDATION time has passed
		// since the PartInstance has been nexted or taken, simulate the PieceInstances using the Piece collection.
		const now = getCurrentTime()
		if (
			pieceInstanceSimulation &&
			results.length === 0 &&
			(!partInstance.timings ||
				(partInstance.timings.next || 0) > now - SIMULATION_INVALIDATION ||
				(partInstance.timings.take || 0) > now - SIMULATION_INVALIDATION)
		) {
			// make sure to invalidate the current computation after SIMULATION_INVALIDATION has passed
			invalidateAfter(SIMULATION_INVALIDATION)
			return getPieceInstancesForPart(
				playlistActivationId || protectString(''),
				currentPartInstance,
				currentPartInstancePieceInstances,
				rundown,
				partInstance.part,
				partsBeforeThisInSegmentSet,
				segmentsBeforeThisInRundownSet,
				rundownsBeforeThisInPlaylist,
				rundownsToShowstyles,
				fetchPiecesThatMayBeActiveForPart(
					partInstance.part,
					partsBeforeThisInSegmentSet,
					segmentsBeforeThisInRundownSet,
					rundownsBeforeThisInPlaylist
				),
				orderedAllParts,
				partInstance._id,
				nextPartIsAfterCurrentPart,
				true
			)
		} else {
			// otherwise, return results as they are
			return results
		}
	}
}

/**
 * Get all PartInstances (or temporary PartInstances) all segments in all rundowns in a playlist, using given queries
 * to limit the data, in correct order.
 *
 * @export
 * @param {RundownPlaylist} playlist
 * @param {(Mongo.Query<DBSegment> | Mongo.QueryWithModifiers<DBSegment>)} [segmentsQuery]
 * @param {(Mongo.Query<DBPart> | Mongo.QueryWithModifiers<DBPart>)} [partsQuery]
 * @param {Mongo.Query<PartInstance>} [partInstancesQuery]
 * @param {FindOptions<DBSegment>} [segmentsOptions]
 * @param {FindOptions<DBPart>} [partsOptions]
 * @param {FindOptions<PartInstance>} [partInstancesOptions]
 * @return {*}  {Array<{ segment: Segment; partInstances: PartInstance[] }>}
 */
export function getSegmentsWithPartInstances(
	playlist: RundownPlaylist,
	segmentsQuery?: Mongo.Query<DBSegment> | Mongo.QueryWithModifiers<DBSegment>,
	partsQuery?: Mongo.Query<DBPart> | Mongo.QueryWithModifiers<DBPart>,
	partInstancesQuery?: Mongo.Query<PartInstance>,
	segmentsOptions?: FindOptions<DBSegment>,
	partsOptions?: FindOptions<DBPart>,
	partInstancesOptions?: FindOptions<PartInstance>
): Array<{ segment: Segment; partInstances: PartInstance[] }> {
	const { segments, parts: rawParts } = RundownPlaylistCollectionUtil.getSegmentsAndPartsSync(
		playlist,
		segmentsQuery,
		partsQuery,
		segmentsOptions,
		partsOptions
	)
	const rawPartInstances = RundownPlaylistCollectionUtil.getActivePartInstances(
		playlist,
		partInstancesQuery,
		partInstancesOptions
	)
	const playlistActivationId = playlist.activationId ?? protectString('')

	const partsBySegment = _.groupBy(rawParts, (p) => p.segmentId)
	const partInstancesBySegment = _.groupBy(rawPartInstances, (p) => p.segmentId)

	return segments.map((segment) => {
		const segmentParts = partsBySegment[unprotectString(segment._id)] || []
		const segmentPartInstances = partInstancesBySegment[unprotectString(segment._id)] || []

		if (segmentPartInstances.length === 0) {
			return {
				segment,
				partInstances: segmentParts.map((p) => wrapPartToTemporaryInstance(playlistActivationId, p)),
			}
		} else if (segmentParts.length === 0) {
			return {
				segment,
				partInstances: _.sortBy(segmentPartInstances, (p) => p.part._rank),
			}
		} else {
			const partInstanceMap = new Map<PartId, PartInstance>()
			for (const part of segmentParts)
				partInstanceMap.set(part._id, wrapPartToTemporaryInstance(playlistActivationId, part))
			for (const partInstance of segmentPartInstances) {
				// Check what we already have in the map for this PartId. If the map returns the currentPartInstance then we keep that, otherwise replace with this partInstance
				const currentValue = partInstanceMap.get(partInstance.part._id)
				if (!currentValue || currentValue._id !== playlist.currentPartInstanceId) {
					partInstanceMap.set(partInstance.part._id, partInstance)
				}
			}

			const allPartInstances = _.sortBy(Array.from(partInstanceMap.values()), (p) => p.part._rank)

			return {
				segment,
				partInstances: allPartInstances,
			}
		}
	})
}

// 1 reactivelly listen to data changes
/*
setup () {
	RundownPlaylists.find().observeChanges(
		asdf: onReactiveDataChange
	)
}

onReactiveDataChange () {
	setTimeoutIgnore(() => {
		updateCalculatedData()
	}, 200)
}

const cachedSegments = {}
updateCalculatedData () {

	const data = calculateBigDataSet()

	data.segments
}
*/

function compareLabels(a: string | ITranslatableMessage, b: string | ITranslatableMessage) {
	const actualA = isTranslatableMessage(a) ? a.key : (a as string)
	const actualB = isTranslatableMessage(b) ? b.key : (b as string)
	// can't use .localeCompare, because this needs to be locale-independent and always return
	// the same sorting order, because that's being relied upon by limit & pick/pickEnd.
	if (actualA > actualB) return 1
	if (actualA < actualB) return -1
	return 0
}

/** Sort a list of adlibs */
export function sortAdlibs<T>(
	adlibs: {
		adlib: T
		label: string | ITranslatableMessage
		adlibRank: number
		adlibId: ProtectedString<any> | string
		partRank: number | null
		segmentRank: number | null
		rundownRank: number | null
		/** Allows to maintain ordering stability on data returned from a Meteor Cursor */
		cursorIndex: number | null
	}[]
) {
	adlibs = adlibs.sort((a, b) => {
		// Sort by rundown rank, where applicable:
		a.rundownRank = a.rundownRank ?? Number.POSITIVE_INFINITY
		b.rundownRank = b.rundownRank ?? Number.POSITIVE_INFINITY
		if (a.rundownRank > b.rundownRank) return 1
		if (a.rundownRank < b.rundownRank) return -1

		// Sort by segment rank, where applicable:
		a.segmentRank = a.segmentRank ?? Number.POSITIVE_INFINITY
		b.segmentRank = b.segmentRank ?? Number.POSITIVE_INFINITY
		if (a.segmentRank > b.segmentRank) return 1
		if (a.segmentRank < b.segmentRank) return -1

		// Sort by part rank, where applicable:
		a.partRank = a.partRank ?? Number.POSITIVE_INFINITY
		b.partRank = b.partRank ?? Number.POSITIVE_INFINITY
		if (a.partRank > b.partRank) return 1
		if (a.partRank < b.partRank) return -1

		// Sort by adlib rank
		if (a.adlibRank > b.adlibRank) return 1
		if (a.adlibRank < b.adlibRank) return -1

		// If defined, maintain the cursor index at this point
		a.cursorIndex = a.cursorIndex ?? Number.POSITIVE_INFINITY
		b.cursorIndex = b.cursorIndex ?? Number.POSITIVE_INFINITY
		if (a.cursorIndex > b.cursorIndex) return 1
		if (a.cursorIndex < b.cursorIndex) return -1

		// Sort by labels:
		const r = compareLabels(a.label, b.label)
		if (r !== 0) return r

		// As a last resort, sort by ids:
		if (a.adlibId > b.adlibId) return 1
		if (a.adlibId < b.adlibId) return -1

		return 0
	})

	return adlibs.map((a) => a.adlib)
}
