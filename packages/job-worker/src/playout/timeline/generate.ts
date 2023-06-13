import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JobContext } from '../../jobs'
import { ReadonlyDeep } from 'type-fest'
import {
	BlueprintResultBaseline,
	BlueprintResultTimeline,
	OnGenerateTimelineObj,
	Time,
	TSR,
} from '@sofie-automation/blueprints-integration'
import {
	deserializeTimelineBlob,
	OnGenerateTimelineObjExt,
	serializeTimelineBlob,
	TimelineComplete,
	TimelineCompleteGenerationVersions,
	TimelineEnableExt,
	TimelineObjGeneric,
	TimelineObjRundown,
	TimelineObjType,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	applyToArray,
	clone,
	getRandomId,
	literal,
	normalizeArray,
	omit,
	stringifyError,
} from '@sofie-automation/corelib/dist/lib'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from '../cache'
import { logger } from '../../logging'
import { getCurrentTime, getSystemVersion } from '../../lib'
import { getResolvedPiecesFromFullTimeline } from '../pieces'
import {
	processAndPrunePieceInstanceTimings,
	PieceInstanceWithTimings,
} from '@sofie-automation/corelib/dist/playout/infinites'
import { CacheForStudio, CacheForStudioBase } from '../../studio/cache'
import { getLookeaheadObjects } from '../lookahead'
import { StudioBaselineContext, OnTimelineGenerateContext } from '../../blueprints/context'
import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { WatchedPackagesHelper } from '../../blueprints/context/watchedPackages'
import { postProcessStudioBaselineObjects } from '../../blueprints/postProcess'
import { updateBaselineExpectedPackagesOnStudio } from '../../ingest/expectedPackages'
import { endTrace, sendTrace, startTrace } from '@sofie-automation/corelib/dist/influxdb'
import { StudioLight } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { deserializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { convertResolvedPieceInstanceToBlueprints } from '../../blueprints/context/lib'
import { buildTimelineObjsForRundown, RundownTimelineTimingContext } from './rundown'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { deNowifyMultiGatewayTimeline } from './multi-gateway'
import { validateTimeline } from 'superfly-timeline'
import {
	calculatePartTimings,
	getPartTimingsOrDefaults,
	PartCalculatedTimings,
} from '@sofie-automation/corelib/dist/playout/timings'
import { applyAbPlaybackForTimeline } from '../abPlayback'

function isCacheForStudio(cache: CacheForStudioBase): cache is CacheForStudio {
	const tmp = cache as CacheForStudio
	return !!tmp.isStudio
}

function generateTimelineVersions(
	studio: ReadonlyDeep<StudioLight>,
	blueprintId: BlueprintId | undefined,
	blueprintVersion: string
): TimelineCompleteGenerationVersions {
	return {
		core: getSystemVersion(),
		blueprintId: blueprintId,
		blueprintVersion: blueprintVersion,
		studio: studio._rundownVersionHash,
	}
}

export async function updateStudioTimeline(
	context: JobContext,
	cache: CacheForStudio | CacheForPlayout
): Promise<void> {
	const span = context.startSpan('updateStudioTimeline')
	logger.debug('updateStudioTimeline running...')
	const studio = context.studio
	// Ensure there isn't a playlist active, as that should be using a different function call
	if (isCacheForStudio(cache)) {
		const activePlaylists = cache.getActiveRundownPlaylists()
		if (activePlaylists.length > 0) {
			throw new Error(`Studio has an active playlist`)
		}
	} else {
		if (cache.Playlist.doc.activationId) {
			throw new Error(`Studio has an active playlist`)
		}
	}

	let baselineObjects: TimelineObjRundown[] = []
	let studioBaseline: BlueprintResultBaseline | undefined

	const studioBlueprint = context.studioBlueprint
	if (studioBlueprint) {
		const watchedPackages = await WatchedPackagesHelper.create(context, studio._id, {
			fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS,
		})

		const blueprint = studioBlueprint.blueprint
		try {
			studioBaseline = blueprint.getBaseline(
				new StudioBaselineContext(
					{ name: 'studioBaseline', identifier: `studioId=${studio._id}` },
					context,
					watchedPackages
				)
			)
		} catch (err) {
			logger.error(`Error in studioBlueprint.getBaseline: ${stringifyError(err)}`)
			studioBaseline = {
				timelineObjects: [],
			}
		}
		baselineObjects = postProcessStudioBaselineObjects(studio.blueprintId, studioBaseline.timelineObjects)
	}

	const versions = generateTimelineVersions(
		studio,
		studio.blueprintId,
		studioBlueprint?.blueprint?.blueprintVersion ?? '-'
	)

	flattenAndProcessTimelineObjects(context, baselineObjects)

	// Future: We should handle any 'now' objects that are at the root of this timeline
	preserveOrReplaceNowTimesInObjects(cache, baselineObjects)

	if (cache.isMultiGatewayMode) {
		logAnyRemainingNowTimes(context, baselineObjects)
	}

	saveTimeline(context, cache, baselineObjects, versions)

	if (studioBaseline) {
		updateBaselineExpectedPackagesOnStudio(context, cache, studioBaseline)
	}

	logger.debug('updateStudioTimeline done!')
	if (span) span.end()
}

export async function updateTimeline(
	context: JobContext,
	cache: CacheForPlayout,
	timeOffsetIntoPart?: Time
): Promise<void> {
	const span = context.startSpan('updateTimeline')
	logger.debug('updateTimeline running...')

	if (!cache.Playlist.doc.activationId) {
		throw new Error(`RundownPlaylist ("${cache.Playlist.doc._id}") is not active")`)
	}

	const { versions, objs: timelineObjs, timingContext: timingInfo } = await getTimelineRundown(context, cache)

	flattenAndProcessTimelineObjects(context, timelineObjs)

	preserveOrReplaceNowTimesInObjects(cache, timelineObjs)

	if (cache.isMultiGatewayMode) {
		deNowifyMultiGatewayTimeline(context, cache, timelineObjs, timeOffsetIntoPart, timingInfo)

		logAnyRemainingNowTimes(context, timelineObjs)
	}

	saveTimeline(context, cache, timelineObjs, versions)

	logger.debug('updateTimeline done!')

	if (span) span.end()
}

function preserveOrReplaceNowTimesInObjects(cache: CacheForStudioBase, timelineObjs: Array<TimelineObjGeneric>) {
	const timeline = cache.Timeline.doc
	const oldTimelineObjsMap = normalizeArray(
		(timeline?.timelineBlob !== undefined && deserializeTimelineBlob(timeline.timelineBlob)) || [],
		'id'
	)

	timelineObjs.forEach((tlo: TimelineObjGeneric) => {
		// A timeline object is updated if found in both collections

		const tloldo: TimelineObjGeneric | undefined = oldTimelineObjsMap[tlo.id]

		let oldNow: TSR.Timeline.TimelineEnable['start'] | undefined
		if (tloldo && tloldo.enable) {
			applyToArray(tloldo.enable, (enable) => {
				if (enable.setFromNow) oldNow = enable.start
			})
		}

		if (oldNow !== undefined) {
			applyToArray(tlo.enable, (enable) => {
				if (enable.start === 'now') {
					enable.start = oldNow
					enable.setFromNow = true
				}
			})
		}
	})
}

function logAnyRemainingNowTimes(_context: JobContext, timelineObjs: Array<TimelineObjGeneric>): void {
	const ids: string[] = []

	const hasNow = (obj: TimelineEnableExt | TimelineEnableExt[]) => {
		let res = false
		applyToArray(obj, (enable) => {
			if (enable.start === 'now' || enable.end === 'now') res = true
		})
		return res
	}

	for (const obj of timelineObjs) {
		if (hasNow(obj.enable)) {
			ids.push(obj.id)
		}

		for (const kf of obj.keyframes || []) {
			if (hasNow(kf.enable)) {
				ids.push(kf.id)
			}
		}
	}

	if (ids.length) {
		logger.error(`Some timeline objects have unexpected now times!: ${JSON.stringify(ids)}`)
	}
}

/** Store the timelineobjects into the cache, and perform any post-save actions */
export function saveTimeline(
	context: JobContext,
	cache: CacheForStudioBase,
	timelineObjs: TimelineObjGeneric[],
	generationVersions: TimelineCompleteGenerationVersions
): void {
	const newTimeline: TimelineComplete = {
		_id: context.studio._id,
		timelineHash: getRandomId(), // randomized on every timeline change
		generated: getCurrentTime(),
		timelineBlob: serializeTimelineBlob(timelineObjs),
		generationVersions: generationVersions,
	}

	cache.Timeline.replace(newTimeline)

	// Also do a fast-track for the timeline to be published faster:
	context.hackPublishTimelineToFastTrack(newTimeline)
}

export interface SelectedPartInstancesTimelineInfo {
	previous?: SelectedPartInstanceTimelineInfo
	current?: SelectedPartInstanceTimelineInfo
	next?: SelectedPartInstanceTimelineInfo
}
export interface SelectedPartInstanceTimelineInfo {
	nowInPart: number
	partInstance: DBPartInstance
	pieceInstances: PieceInstanceWithTimings[]
	calculatedTimings: PartCalculatedTimings
}

function getPartInstanceTimelineInfo(
	cache: CacheForPlayout,
	currentTime: Time,
	sourceLayers: SourceLayers,
	partInstance: DBPartInstance | undefined
): SelectedPartInstanceTimelineInfo | undefined {
	if (partInstance) {
		const partStarted = partInstance.timings?.plannedStartedPlayback
		const nowInPart = partStarted === undefined ? 0 : currentTime - partStarted
		const currentPieces = cache.PieceInstances.findAll((p) => p.partInstanceId === partInstance._id)
		const pieceInstances = processAndPrunePieceInstanceTimings(sourceLayers, currentPieces, nowInPart)

		return {
			partInstance,
			pieceInstances,
			nowInPart,
			// Approximate `calculatedTimings`, for the partInstances which already have it cached
			calculatedTimings: getPartTimingsOrDefaults(partInstance, pieceInstances),
		}
	} else {
		return undefined
	}
}

/**
 * Returns timeline objects related to rundowns in a studio
 */
async function getTimelineRundown(
	context: JobContext,
	cache: CacheForPlayout
): Promise<{
	objs: Array<TimelineObjRundown>
	versions: TimelineCompleteGenerationVersions
	timingContext: RundownTimelineTimingContext | undefined
}> {
	const span = context.startSpan('getTimelineRundown')
	try {
		let timelineObjs: Array<TimelineObjGeneric & OnGenerateTimelineObjExt> = []

		const { currentPartInstance, nextPartInstance, previousPartInstance } = getSelectedPartInstancesFromCache(cache)

		const partForRundown = currentPartInstance || nextPartInstance
		const activeRundown = partForRundown && cache.Rundowns.findOne(partForRundown.rundownId)

		let timelineVersions: TimelineCompleteGenerationVersions | undefined
		if (activeRundown) {
			// Fetch showstyle blueprint:
			const showStyle = await context.getShowStyleCompound(
				activeRundown.showStyleVariantId,
				activeRundown.showStyleBaseId
			)
			if (!showStyle) {
				throw new Error(
					`ShowStyleBase "${activeRundown.showStyleBaseId}" not found! (referenced by Rundown "${activeRundown._id}")`
				)
			}

			const currentTime = getCurrentTime()
			const partInstancesInfo: SelectedPartInstancesTimelineInfo = {
				current: getPartInstanceTimelineInfo(cache, currentTime, showStyle.sourceLayers, currentPartInstance),
				next: getPartInstanceTimelineInfo(cache, currentTime, showStyle.sourceLayers, nextPartInstance),
				previous: getPartInstanceTimelineInfo(cache, currentTime, showStyle.sourceLayers, previousPartInstance),
			}
			if (partInstancesInfo.next) {
				// the nextPartInstance doesn't have accurate cached `calculatedTimings` yet, so calculate a prediction
				partInstancesInfo.next.calculatedTimings = calculatePartTimings(
					cache.Playlist.doc.holdState,
					partInstancesInfo.current?.partInstance?.part,
					partInstancesInfo.current?.pieceInstances?.map?.((p) => p.piece),
					partInstancesInfo.next.partInstance.part,
					partInstancesInfo.next.pieceInstances
						.filter((p) => !p.infinite || p.infinite.infiniteInstanceIndex === 0)
						.map((p) => p.piece)
				)
			}

			// next (on pvw (or on pgm if first))
			const pLookaheadObjs = getLookeaheadObjects(context, cache, partInstancesInfo)
			const rawBaselineItems = cache.BaselineObjects.findAll((o) => o.rundownId === activeRundown._id)
			if (rawBaselineItems.length > 0) {
				timelineObjs = timelineObjs.concat(transformBaselineItemsIntoTimeline(rawBaselineItems))
			} else {
				logger.warn(`Missing Baseline objects for Rundown "${activeRundown._id}"`)
			}

			const rundownTimelineResult = buildTimelineObjsForRundown(context, cache, activeRundown, partInstancesInfo)

			timelineObjs = timelineObjs.concat(rundownTimelineResult.timeline)
			timelineObjs = timelineObjs.concat(await pLookaheadObjs)

			const blueprint = await context.getShowStyleBlueprint(showStyle._id)
			timelineVersions = generateTimelineVersions(
				context.studio,
				showStyle.blueprintId,
				blueprint.blueprint.blueprintVersion
			)

			if (blueprint.blueprint.onTimelineGenerate || blueprint.blueprint.getAbResolverConfiguration) {
				const resolvedPieces = getResolvedPiecesFromFullTimeline(context, cache, timelineObjs)
				const blueprintContext = new OnTimelineGenerateContext(
					context.studio,
					context.getStudioBlueprintConfig(),
					showStyle,
					context.getShowStyleBlueprintConfig(showStyle),
					cache.Playlist.doc,
					activeRundown,
					previousPartInstance,
					currentPartInstance,
					nextPartInstance,
					resolvedPieces.pieces
				)
				try {
					const abHelper = blueprintContext.abSessionsHelper // Future: this should be removed from OnTimelineGenerateContext once the methods are removed from the api
					const newAbSessionsResult = applyAbPlaybackForTimeline(
						context,
						abHelper,
						blueprint,
						showStyle,
						cache.Playlist.doc,
						resolvedPieces.pieces,
						timelineObjs
					)

					let tlGenRes: BlueprintResultTimeline | undefined
					if (blueprint.blueprint.onTimelineGenerate) {
						const span = context.startSpan('blueprint.onTimelineGenerate')
						const influxTrace = startTrace('blueprints:onTimelineGenerate')
						tlGenRes = await blueprint.blueprint.onTimelineGenerate(
							blueprintContext,
							timelineObjs,
							clone(cache.Playlist.doc.previousPersistentState),
							clone(currentPartInstance?.previousPartEndState),
							resolvedPieces.pieces.map(convertResolvedPieceInstanceToBlueprints)
						)
						sendTrace(endTrace(influxTrace))
						if (span) span.end()

						timelineObjs = tlGenRes.timeline.map((object: OnGenerateTimelineObj<any>) => {
							return literal<TimelineObjGeneric & OnGenerateTimelineObjExt>({
								...(object as OnGenerateTimelineObjExt),
								objectType: TimelineObjType.RUNDOWN,
							})
						})
					}

					cache.Playlist.update((p) => {
						p.previousPersistentState = tlGenRes?.persistentState
						p.assignedAbSessions = newAbSessionsResult
						p.trackedAbSessions = blueprintContext.abSessionsHelper.knownSessions
						return p
					})
				} catch (err) {
					// TODO - this may not be sufficient?
					logger.error(`Error in showStyleBlueprint.onTimelineGenerate: ${stringifyError(err)}`)
				}
			}

			if (span) span.end()
			return {
				objs: timelineObjs.map<TimelineObjRundown>((timelineObj) => {
					return {
						...omit(timelineObj, 'pieceInstanceId', 'infinitePieceInstanceId', 'partInstanceId'), // temporary fields from OnGenerateTimelineObj
						objectType: TimelineObjType.RUNDOWN,
					}
				}),
				versions: timelineVersions ?? generateTimelineVersions(context.studio, undefined, '-'),
				timingContext: rundownTimelineResult.timingContext,
			}
		} else {
			if (span) span.end()
			logger.error('No active rundown during updateTimeline')
			return {
				objs: [],
				versions: generateTimelineVersions(context.studio, undefined, '-'),
				timingContext: undefined,
			}
		}
	} catch (e) {
		if (span) span.end()
		logger.error(`Error in getTimelineRundown: ${stringifyError(e)}`)
		return {
			objs: [],
			versions: generateTimelineVersions(context.studio, undefined, '-'),
			timingContext: undefined,
		}
	}
}

/**
 * Process the timeline objects, to provide some basic validation. Also flattens the nested objects into a single array
 * Note: Input array is mutated in place
 * @param context
 * @param timelineObjs Array of timeline objects
 */
function flattenAndProcessTimelineObjects(context: JobContext, timelineObjs: Array<TimelineObjGeneric>): void {
	const span = context.startSpan('processTimelineObjects')

	// first, split out any grouped objects, to make the timeline shallow:
	const fixObjectChildren = (o: TimelineObjGeneric): void => {
		// Unravel children objects and put them on the (flat) timelineObjs array
		if (o.isGroup && o.children && o.children.length) {
			for (const child of o.children) {
				const childFixed: TimelineObjGeneric = {
					...child,
					objectType: o.objectType,
					inGroup: o.id,
				}
				if (!childFixed.id) logger.error(`TimelineObj missing id attribute (child of ${o.id})`, childFixed)
				timelineObjs.push(childFixed)

				fixObjectChildren(childFixed)
			}
			o.children = []
		}
	}

	for (const obj of timelineObjs) {
		fixObjectChildren(obj)
	}

	try {
		// Do a validation of the timeline, to ensure that it doesn't contain any nastiness that can crash the Timeline-resolving later.
		validateTimeline(timelineObjs, true)
	} catch (err) {
		throw new Error(`Error in generated timeline: Validation failed: ${err}`)
	}

	if (span) span.end()
}

/**
 * Convert RundownBaselineObj into TimelineObjects for the timeline
 */
function transformBaselineItemsIntoTimeline(
	objs: RundownBaselineObj[]
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []
	for (const obj of objs) {
		const objects = deserializePieceTimelineObjectsBlob(obj.timelineObjectsString)
		// the baseline objects are layed out without any grouping
		for (const o of objects) {
			timelineObjs.push({
				metaData: undefined,
				...o,
				objectType: TimelineObjType.RUNDOWN,
				partInstanceId: null,
			})
		}
	}
	return timelineObjs
}
