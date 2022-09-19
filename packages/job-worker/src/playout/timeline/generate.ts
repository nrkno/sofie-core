import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JobContext } from '../../jobs'
import { ReadonlyDeep } from 'type-fest'
import { BlueprintResultBaseline, OnGenerateTimelineObj, Time, TSR } from '@sofie-automation/blueprints-integration'
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
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
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
import { buildTimelineObjsForRundown } from './rundown'
import { PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { getExpectedLatency } from '@sofie-automation/corelib/dist/studio/playout'
import { getPartGroupId } from '@sofie-automation/corelib/dist/playout/ids'
import { PieceTimelineMetadata } from '@sofie-automation/corelib/dist/playout/pieces'

function isCacheForStudio(cache: CacheForStudioBase): cache is CacheForStudio {
	const cache2 = cache as CacheForStudio
	return !!cache2.isStudio
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
					studio,
					context.getStudioBlueprintConfig(),
					watchedPackages
				)
			)
		} catch (err) {
			logger.error(`Error in studioBlueprint.getBaseline: ${stringifyError(err)}`)
			studioBaseline = {
				timelineObjects: [],
			}
		}
		baselineObjects = postProcessStudioBaselineObjects(studio, studioBaseline.timelineObjects)
	}

	const versions = generateTimelineVersions(
		studio,
		studio.blueprintId,
		studioBlueprint?.blueprint?.blueprintVersion ?? '-'
	)

	flattenAndProcessTimelineObjects(context, baselineObjects)

	// const nowOffsetLatency = calculateNowOffsetTimeline(context, cache, undefined)
	// const newNowTime = typeof nowOffsetLatency === 'number' ? getCurrentTime() + nowOffsetLatency : null
	// TODO - de-nowify any root objects, as that is reasonable to have here
	preserveOrReplaceNowTimesInObjects(cache, baselineObjects)

	logAnyRemainingNowTimes(context, cache, baselineObjects)

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

	const { versions, objs: timelineObjs } = await getTimelineRundown(context, cache)

	flattenAndProcessTimelineObjects(context, timelineObjs)
	const timelineObjsMap = normalizeArray(timelineObjs, 'id')

	const nowOffsetLatency = calculateNowOffsetTimeline(context, cache, timeOffsetIntoPart)
	const targetNowTime = getCurrentTime() + (nowOffsetLatency ?? 0)

	preserveOrReplaceNowTimesInObjects(cache, timelineObjs)

	if (cache.isMultiGatewayMode) {
		// Replace `start: 'now'` in currentPartInstance on timeline
		const { currentPartInstance, previousPartInstance } = getSelectedPartInstancesFromCache(cache)
		if (currentPartInstance) {
			const currentPartGroupId = getPartGroupId(currentPartInstance)
			if (!currentPartInstance.timings?.plannedStartedPlayback) {
				// Looks like the part is just being taken
				cache.PartInstances.update(currentPartInstance._id, (instance) => {
					if (!instance.timings) instance.timings = {}
					instance.timings.plannedStartedPlayback = targetNowTime
					return instance
				})

				// Also mark the previous as ended
				if (
					previousPartInstance &&
					!previousPartInstance.timings?.plannedStoppedPlayback &&
					previousPartInstance.timings?.plannedStartedPlayback
				) {
					cache.PartInstances.update(previousPartInstance._id, (instance) => {
						if (!instance.timings) instance.timings = {}
						instance.timings.plannedStoppedPlayback = targetNowTime
						return instance
					})
				}

				// Reflect this in the timeline
				const currentPartGroup = timelineObjsMap[currentPartGroupId]
				if (currentPartGroup) {
					applyToArray(currentPartGroup.enable, (val) => {
						val.start = targetNowTime
					})
				} else {
					logger.error(`Unable to find currentPartInstance group "${currentPartGroupId}" on timeline`)
				}
			}

			// The relative time for 'now' to be resolved to, inside of the part group
			const nowInPart = (currentPartInstance.timings?.plannedStartedPlayback ?? targetNowTime) - targetNowTime

			// Ensure any pieces in the currentPartInstance have their now replaced
			cache.PieceInstances.update(
				(p) => p.partInstanceId === currentPartInstance._id,
				(p) => {
					if (p.piece.enable.start === 'now') {
						p.piece.enable.start = nowInPart
						return p
					}

					// No change
					return false
				}
			)

			// Pieces without concrete times will add some special 'now' objects to the timeline that they can reference
			// Make sure that the all have concrete times attached
			for (const obj of timelineObjs) {
				const objMetadata = obj.metaData as Partial<PieceTimelineMetadata> | undefined
				if (objMetadata?.isPieceTimeline && obj.id.endsWith(`_now`)) {
					obj.enable = { start: targetNowTime }
				}
			}
		}

		logAnyRemainingNowTimes(context, cache, timelineObjs)
	}

	saveTimeline(context, cache, timelineObjs, versions)

	logger.debug('updateTimeline done!')

	if (span) span.end()
}

function calculateNowOffsetTimeline(
	context: JobContext,
	cache: CacheForStudioBase,
	timeOffsetIntoPart: Time | undefined
): Time | undefined {
	/** The timestamp that "now" was set to */
	let nowOffsetLatency: Time | undefined

	if (cache.isMultiGatewayMode) {
		const playoutDevices = cache.PeripheralDevices.findFetch(
			(device) => device.type === PeripheralDeviceType.PLAYOUT
		)
		const worstLatency = Math.max(0, ...playoutDevices.map((device) => getExpectedLatency(device).safe))
		/** Add a little more latency, to account for network latency variability */
		const ADD_SAFE_LATENCY = context.studio.settings.nowSafeLatency || 30
		nowOffsetLatency = worstLatency + ADD_SAFE_LATENCY
	}

	if (timeOffsetIntoPart) {
		// Include the requested offset
		nowOffsetLatency = (nowOffsetLatency ?? 0) - timeOffsetIntoPart
	}

	return nowOffsetLatency
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
			setNowForObjToValue(tlo, oldNow)
		}
	})
}

function setNowForObjToValue(tlo: TimelineObjGeneric, oldNow: TSR.Timeline.TimelineEnable['start']): void {
	applyToArray(tlo.enable, (enable) => {
		if (enable.start === 'now') {
			enable.start = oldNow
			enable.setFromNow = true
		}
	})
}

function logAnyRemainingNowTimes(
	_context: JobContext,
	cache: CacheForStudioBase,
	timelineObjs: Array<TimelineObjGeneric>
): void {
	if (cache.isMultiGatewayMode) {
		const ids: string[] = []

		const hasNow = (obj: TimelineEnableExt | TimelineEnableExt[]) => {
			let res = false
			applyToArray(obj, (enable) => {
				if (enable.start === 'now') res = true
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
}

function getPartInstanceTimelineInfo(
	cache: CacheForPlayout,
	currentTime: Time,
	showStyle: ReadonlyDeep<DBShowStyleBase>,
	partInstance: DBPartInstance | undefined
): SelectedPartInstanceTimelineInfo | undefined {
	if (partInstance) {
		const partStarted = partInstance.timings?.plannedStartedPlayback
		const nowInPart = partStarted === undefined ? 0 : currentTime - partStarted
		const currentPieces = cache.PieceInstances.findFetch({ partInstanceId: partInstance._id })
		const pieceInstances = processAndPrunePieceInstanceTimings(showStyle, currentPieces, nowInPart)

		return {
			partInstance,
			pieceInstances,
			nowInPart,
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
): Promise<{ objs: Array<TimelineObjRundown>; versions: TimelineCompleteGenerationVersions }> {
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
				current: getPartInstanceTimelineInfo(cache, currentTime, showStyle, currentPartInstance),
				next: getPartInstanceTimelineInfo(cache, currentTime, showStyle, nextPartInstance),
				previous: getPartInstanceTimelineInfo(cache, currentTime, showStyle, previousPartInstance),
			}

			// next (on pvw (or on pgm if first))
			const pLookaheadObjs = getLookeaheadObjects(context, cache, partInstancesInfo)
			const rawBaselineItems = cache.BaselineObjects.findFetch((o) => o.rundownId === activeRundown._id)
			if (rawBaselineItems.length > 0) {
				timelineObjs = timelineObjs.concat(transformBaselineItemsIntoTimeline(rawBaselineItems))
			} else {
				logger.warn(`Missing Baseline objects for Rundown "${activeRundown._id}"`)
			}

			timelineObjs = timelineObjs.concat(
				buildTimelineObjsForRundown(context, cache, activeRundown, partInstancesInfo)
			)
			timelineObjs = timelineObjs.concat(await pLookaheadObjs)

			const blueprint = await context.getShowStyleBlueprint(showStyle._id)
			timelineVersions = generateTimelineVersions(
				context.studio,
				showStyle.blueprintId,
				blueprint.blueprint.blueprintVersion
			)

			if (blueprint.blueprint.onTimelineGenerate) {
				const context2 = new OnTimelineGenerateContext(
					context.studio,
					context.getStudioBlueprintConfig(),
					showStyle,
					context.getShowStyleBlueprintConfig(showStyle),
					cache.Playlist.doc,
					activeRundown,
					previousPartInstance,
					currentPartInstance,
					nextPartInstance
				)
				const resolvedPieces = getResolvedPiecesFromFullTimeline(context, cache, timelineObjs)
				context2.trackPieceInstances(resolvedPieces.pieces)
				try {
					const span = context.startSpan('blueprint.onTimelineGenerate')
					const influxTrace = startTrace('blueprints:onTimelineGenerate')
					const tlGenRes = await blueprint.blueprint.onTimelineGenerate(
						context2,
						timelineObjs,
						clone(cache.Playlist.doc.previousPersistentState),
						clone(currentPartInstance?.previousPartEndState),
						resolvedPieces.pieces.map(convertResolvedPieceInstanceToBlueprints)
					)
					sendTrace(endTrace(influxTrace))
					if (span) span.end()
					timelineObjs = tlGenRes.timeline.map((object: OnGenerateTimelineObj) => {
						return literal<TimelineObjGeneric & OnGenerateTimelineObjExt>({
							...(object as OnGenerateTimelineObjExt),
							objectType: TimelineObjType.RUNDOWN,
						})
					})
					cache.Playlist.update({
						$set: {
							previousPersistentState: tlGenRes.persistentState,
							trackedAbSessions: context2.knownSessions,
						},
					})
				} catch (err) {
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
			}
		} else {
			if (span) span.end()
			logger.error('No active rundown during updateTimeline')
			return {
				objs: [],
				versions: generateTimelineVersions(context.studio, undefined, '-'),
			}
		}
	} catch (e) {
		if (span) span.end()
		logger.error(`Error in getTimelineRundown: ${stringifyError(e)}`)
		return {
			objs: [],
			versions: generateTimelineVersions(context.studio, undefined, '-'),
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
			const children = o.children as TSR.TSRTimelineObjBase[]
			for (const child of children) {
				const childFixed: TimelineObjGeneric = {
					...child,
					objectType: o.objectType,
					inGroup: o.id,
				}
				if (!childFixed.id) logger.error(`TimelineObj missing id attribute (child of ${o.id})`, childFixed)
				timelineObjs.push(childFixed)

				fixObjectChildren(childFixed)
			}
			delete o.children
		}

		if (o.keyframes) {
			o.keyframes.forEach((kf, i) => {
				kf.id = `${o.id}_keyframe_${i}`
			})
		}
	}

	for (const obj of timelineObjs) {
		fixObjectChildren(obj)
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
