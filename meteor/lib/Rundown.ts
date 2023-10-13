import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { IOutputLayer, ISourceLayer, ITranslatableMessage } from '@sofie-automation/blueprints-integration'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartInstance, wrapPartToTemporaryInstance } from './collections/PartInstances'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	getPieceInstancesForPart,
	buildPiecesStartingInThisPartQuery,
	buildPastInfinitePiecesForThisPartQuery,
} from '@sofie-automation/corelib/dist/playout/infinites'
import { invalidateAfter } from '../lib/invalidatingTime'
import { getCurrentTime, groupByToMap, ProtectedString, protectString } from './lib'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { isTranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { mongoWhereFilter, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { FindOptions } from './collections/lib'
import {
	PartId,
	RundownId,
	RundownPlaylistActivationId,
	SegmentId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstances, Pieces } from './collections/libCollections'
import { RundownPlaylistCollectionUtil } from './collections/rundownPlaylistUtil'
import { PieceContentStatusObj } from './api/pieceContentStatus'
import { ReadonlyDeep } from 'type-fest'
import { PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'

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

export type PartInstanceLimited = Omit<PartInstance, 'isTaken' | 'previousPartEndState'>

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
	/** Maximum width of a label so as not to appear underneath the following item */
	maxLabelWidth?: number
	/** If this piece has a "buddy" piece in the preceeding part, then it's not neccessary to display it's left label */
	hasOriginInPreceedingPart?: boolean

	contentStatus?: ReadonlyDeep<PieceContentStatusObj>
}

function fetchPiecesThatMayBeActiveForPart(
	part: DBPart,
	partsToReceiveOnSegmentEndFromSet: Set<PartId>,
	segmentsToReceiveOnRundownEndFromSet: Set<SegmentId>,
	rundownsToReceiveOnShowStyleEndFrom: RundownId[],
	/** Map of Pieces on Parts, passed through for performance */
	allPiecesCache?: Map<PartId, Piece[]>
): Piece[] {
	let piecesStartingInPart: Piece[]
	const allPieces = allPiecesCache?.get(part._id)
	const selector = buildPiecesStartingInThisPartQuery(part)
	if (allPieces) {
		// Fast-path: if we already have the pieces, we can use them directly:
		piecesStartingInPart = mongoWhereFilter(allPieces, selector)
	} else {
		piecesStartingInPart = Pieces.find(selector).fetch()
	}

	const partsToReceiveOnSegmentEndFrom = Array.from(partsToReceiveOnSegmentEndFromSet.values())
	const segmentsToReceiveOnRundownEndFrom = Array.from(segmentsToReceiveOnRundownEndFromSet.values())

	const infinitePieceQuery = buildPastInfinitePiecesForThisPartQuery(
		part,
		partsToReceiveOnSegmentEndFrom,
		segmentsToReceiveOnRundownEndFrom,
		rundownsToReceiveOnShowStyleEndFrom
	)
	let infinitePieces: Piece[]
	if (allPieces) {
		// Fast-path: if we already have the pieces, we can use them directly:
		infinitePieces = infinitePieceQuery ? mongoWhereFilter(allPieces, infinitePieceQuery) : []
	} else {
		infinitePieces = infinitePieceQuery ? Pieces.find(infinitePieceQuery).fetch() : []
	}

	return piecesStartingInPart.concat(infinitePieces) // replace spread with concat, as 3x is faster (https://stackoverflow.com/questions/48865710/spread-operator-vs-array-concat)
}

const SIMULATION_INVALIDATION = 3000

/**
 * Get the PieceInstances for a given PartInstance. Will create temporary PieceInstances, based on the Pieces collection
 * if the partInstance is temporary.
 *
 * @export
 * @param {PartInstanceLimited} partInstance
 * @param {Set<PartId>} partsToReceiveOnSegmentEndFromSet
 * @param {Set<SegmentId>} segmentsToReceiveOnRundownEndFromSet
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
	segment: Pick<DBSegment, '_id' | 'orphaned'>,
	partInstance: PartInstanceLimited,
	partsToReceiveOnSegmentEndFromSet: Set<PartId>,
	segmentsToReceiveOnRundownEndFromSet: Set<SegmentId>,
	rundownsToReceiveOnShowStyleEndFrom: RundownId[],
	rundownsToShowstyles: Map<RundownId, ShowStyleBaseId>,
	orderedAllParts: PartId[],
	nextPartIsAfterCurrentPart: boolean,
	currentPartInstance: PartInstance | undefined,
	currentSegment: Pick<DBSegment, '_id' | 'orphaned'> | undefined,
	currentPartInstancePieceInstances: PieceInstance[] | undefined,
	/** Map of Pieces on Parts, passed through for performance */
	allPiecesCache?: Map<PartId, Piece[]>,
	options?: FindOptions<PieceInstance>,
	pieceInstanceSimulation?: boolean
): PieceInstance[] {
	if (segment.orphaned === SegmentOrphanedReason.SCRATCHPAD) {
		// When in the scratchpad, don't allow searching other segments/rundowns for infinites to continue
		segmentsToReceiveOnRundownEndFromSet = new Set()
		rundownsToReceiveOnShowStyleEndFrom = []
	}

	if (partInstance.isTemporary) {
		return getPieceInstancesForPart(
			playlistActivationId || protectString(''),
			currentPartInstance,
			currentSegment,
			currentPartInstancePieceInstances,
			rundown,
			segment,
			partInstance.part,
			partsToReceiveOnSegmentEndFromSet,
			segmentsToReceiveOnRundownEndFromSet,
			rundownsToReceiveOnShowStyleEndFrom,
			rundownsToShowstyles,
			fetchPiecesThatMayBeActiveForPart(
				partInstance.part,
				partsToReceiveOnSegmentEndFromSet,
				segmentsToReceiveOnRundownEndFromSet,
				rundownsToReceiveOnShowStyleEndFrom,
				allPiecesCache
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
				(partInstance.timings.setAsNext || 0) > now - SIMULATION_INVALIDATION ||
				(partInstance.timings.take || 0) > now - SIMULATION_INVALIDATION)
		) {
			// make sure to invalidate the current computation after SIMULATION_INVALIDATION has passed
			invalidateAfter(SIMULATION_INVALIDATION)

			return getPieceInstancesForPart(
				playlistActivationId || protectString(''),
				currentPartInstance,
				currentSegment,
				currentPartInstancePieceInstances,
				rundown,
				segment,
				partInstance.part,
				partsToReceiveOnSegmentEndFromSet,
				segmentsToReceiveOnRundownEndFromSet,
				rundownsToReceiveOnShowStyleEndFrom,
				rundownsToShowstyles,
				fetchPiecesThatMayBeActiveForPart(
					partInstance.part,
					partsToReceiveOnSegmentEndFromSet,
					segmentsToReceiveOnRundownEndFromSet,
					rundownsToReceiveOnShowStyleEndFrom,
					allPiecesCache
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
 * @param {DBRundownPlaylist} playlist
 * @param {(MongoQuery<DBSegment>)} [segmentsQuery]
 * @param {(MongoQuery<DBPart>)} [partsQuery]
 * @param {MongoQuery<PartInstance>} [partInstancesQuery]
 * @param {FindOptions<DBSegment>} [segmentsOptions]
 * @param {FindOptions<DBPart>} [partsOptions]
 * @param {FindOptions<PartInstance>} [partInstancesOptions]
 * @return {*}  {Array<{ segment: Segment; partInstances: PartInstance[] }>}
 */
export function getSegmentsWithPartInstances(
	playlist: DBRundownPlaylist,
	segmentsQuery?: MongoQuery<DBSegment>,
	partsQuery?: MongoQuery<DBPart>,
	partInstancesQuery?: MongoQuery<PartInstance>,
	segmentsOptions?: FindOptions<DBSegment>,
	partsOptions?: FindOptions<DBPart>,
	partInstancesOptions?: FindOptions<PartInstance>
): Array<{ segment: DBSegment; partInstances: PartInstance[] }> {
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

	const partsBySegment = groupByToMap(rawParts, 'segmentId')
	const partInstancesBySegment = groupByToMap(rawPartInstances, 'segmentId')

	return segments.map((segment) => {
		const segmentParts = partsBySegment.get(segment._id) ?? []
		const segmentPartInstances = partInstancesBySegment.get(segment._id) ?? []

		if (segmentPartInstances.length === 0) {
			return {
				segment,
				partInstances: segmentParts.map((p) => wrapPartToTemporaryInstance(playlistActivationId, p)),
			}
		} else if (segmentParts.length === 0) {
			return {
				segment,
				partInstances: segmentPartInstances.sort(
					(a, b) => a.part._rank - b.part._rank || a.takeCount - b.takeCount
				),
			}
		} else {
			const partIds: Set<PartId> = new Set()
			for (const partInstance of segmentPartInstances) {
				partIds.add(partInstance.part._id)
			}
			for (const part of segmentParts) {
				if (partIds.has(part._id)) continue
				segmentPartInstances.push(wrapPartToTemporaryInstance(playlistActivationId, part))
			}
			const allPartInstances = segmentPartInstances.sort(
				(a, b) => a.part._rank - b.part._rank || a.takeCount - b.takeCount
			)

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
	}[]
): T[] {
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
