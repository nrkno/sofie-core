import { BlueprintId, PartInstanceId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist, RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { JobContext } from '../jobs'
import { ReadonlyDeep } from 'type-fest'
import {
	BlueprintResultBaseline,
	IBlueprintPartOutTransition,
	IBlueprintPiece,
	IBlueprintPieceType,
	OnGenerateTimelineObj,
	PieceLifespan,
	Time,
	TimelineObjClassesCore,
	TimelineObjectCoreExt,
	TimelineObjHoldMode,
	TSR,
} from '@sofie-automation/blueprints-integration'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	deserializeTimelineBlob,
	OnGenerateTimelineObjExt,
	serializeTimelineBlob,
	TimelineComplete,
	TimelineCompleteGenerationVersions,
	TimelineContentTypeOther,
	TimelineObjGeneric,
	TimelineObjGroupPart,
	TimelineObjPartAbstract,
	TimelineObjRundown,
	TimelineObjType,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	applyToArray,
	assertNever,
	clone,
	getRandomId,
	literal,
	normalizeArray,
	normalizeArrayToMapFunc,
	omit,
	stringifyError,
} from '@sofie-automation/corelib/dist/lib'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from './cache'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { logger } from '../logging'
import _ = require('underscore')
import { PieceInstanceInfinite } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { getCurrentTime, getSystemVersion } from '../lib'
import { getPartFirstObjectId, getPartGroupId } from '@sofie-automation/corelib/dist/playout/ids'
import { createPieceGroupAndCap, PieceTimelineMetadata } from '@sofie-automation/corelib/dist/playout/pieces'
import { createPieceGroupFirstObject, getResolvedPiecesFromFullTimeline } from './pieces'
import { prefixAllObjectIds } from './lib'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import {
	processAndPrunePieceInstanceTimings,
	PieceInstanceWithTimings,
} from '@sofie-automation/corelib/dist/playout/infinites'
import { CacheForStudio, CacheForStudioBase } from '../studio/cache'
import { getLookeaheadObjects } from './lookahead'
import { DEFINITELY_ENDED_FUTURE_DURATION } from './infinites'
import { StudioBaselineContext, OnTimelineGenerateContext } from '../blueprints/context'
import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { postProcessStudioBaselineObjects } from '../blueprints/postProcess'
import { updateBaselineExpectedPackagesOnStudio } from '../ingest/expectedPackages'
import { endTrace, sendTrace, startTrace } from '@sofie-automation/corelib/dist/influxdb'
import { StudioLight } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	calculatePartTimings,
	getPartTimingsOrDefaults,
	PartCalculatedTimings,
} from '@sofie-automation/corelib/dist/playout/timings'
import { deserializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { convertResolvedPieceInstanceToBlueprints } from '../blueprints/context/lib'

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
	processAndSaveTimelineObjects(context, cache, baselineObjects, versions, undefined)

	if (studioBaseline) {
		updateBaselineExpectedPackagesOnStudio(context, cache, studioBaseline)
	}

	logger.debug('updateStudioTimeline done!')
	if (span) span.end()
}

export async function updateTimeline(
	context: JobContext,
	cache: CacheForPlayout,
	forceNowToTime?: Time
): Promise<void> {
	const span = context.startSpan('updateTimeline')
	logger.debug('updateTimeline running...')

	if (!cache.Playlist.doc.activationId) {
		throw new Error(`RundownPlaylist ("${cache.Playlist.doc._id}") is not active")`)
	}

	const timeline = await getTimelineRundown(context, cache)

	processAndSaveTimelineObjects(context, cache, timeline.objs, timeline.versions, forceNowToTime)

	if (span) span.end()
}

function processAndSaveTimelineObjects(
	context: JobContext,
	cache: CacheForStudioBase,
	timelineObjs: Array<TimelineObjGeneric>,
	versions: TimelineCompleteGenerationVersions,
	forceNowToTime: Time | undefined
): void {
	const studio = context.studio
	processTimelineObjects(context, timelineObjs)

	/** The timestamp that "now" was set to */
	let theNowTime = 0

	if (forceNowToTime) {
		// used when autoNexting
		theNowTime = forceNowToTime
	} else {
		// HACK: TODO
		// const playoutDevices = cache.PeripheralDevices.findFetch(
		// 	(device) => device.type === PeripheralDeviceAPI.DeviceType.PLAYOUT
		// )
		// if (
		// 	playoutDevices.length > 1 || // if we have several playout devices, we can't use the Now feature
		// 	studio.settings.forceSettingNowTime
		// ) {
		// 	const worstLatency = Math.max(0, ...playoutDevices.map((device) => getExpectedLatency(device).safe))
		// 	/** Add a little more latency, to account for network latency variability */
		// 	const ADD_SAFE_LATENCY = studio.settings.nowSafeLatency || 30
		// 	theNowTime = getCurrentTime() + worstLatency + ADD_SAFE_LATENCY
		// }
	}
	if (theNowTime) {
		setNowToTimeInObjects(timelineObjs, theNowTime)
	}

	const timeline = cache.Timeline.findOne({
		_id: studio._id,
	})
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

		if (oldNow !== undefined && tlo) {
			applyToArray(tlo.enable, (enable) => {
				if (enable.start === 'now') {
					enable.start = oldNow
					enable.setFromNow = true
				}
			})
		}
	})

	saveTimeline(context, cache, timelineObjs, versions)

	logger.debug('updateTimeline done!')
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

export function getPartInstanceTimelineInfo(
	cache: CacheForPlayout,
	currentTime: Time,
	showStyle: ReadonlyDeep<DBShowStyleBase>,
	partInstance: DBPartInstance | undefined
): SelectedPartInstanceTimelineInfo | undefined {
	if (partInstance) {
		const partLastStarted = partInstance.timings?.startedPlayback
		const nowInPart = partLastStarted === undefined ? 0 : currentTime - partLastStarted
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
 * Fix the timeline objects, adds properties like deviceId and studioId to the timeline objects
 * @param studio
 * @param timelineObjs Array of timeline objects
 */
function processTimelineObjects(context: JobContext, timelineObjs: Array<TimelineObjGeneric>): void {
	const span = context.startSpan('processTimelineObjects')
	// first, split out any grouped objects, to make the timeline shallow:
	const fixObjectChildren = (o: TimelineObjGeneric): void => {
		// Unravel children objects and put them on the (flat) timelineObjs array
		if (o.isGroup && o.children && o.children.length) {
			const children = o.children as TSR.TSRTimelineObjBase[]
			_.each(children, (child: TSR.TSRTimelineObjBase) => {
				const childFixed: TimelineObjGeneric = {
					...child,
					objectType: o.objectType,
					inGroup: o.id,
				}
				if (!childFixed.id) logger.error(`TimelineObj missing id attribute (child of ${o.id})`, childFixed)
				timelineObjs.push(childFixed)

				fixObjectChildren(childFixed)
			})
			delete o.children
		}

		if (o.keyframes) {
			_.each(o.keyframes, (kf, i) => {
				kf.id = `${o.id}_keyframe_${i}`
			})
		}
	}
	_.each(timelineObjs, (o: TimelineObjGeneric) => {
		fixObjectChildren(o)
	})
	if (span) span.end()
}
/**
 * goes through timelineObjs and forces the "now"-values to the absolute time specified
 * @param timelineObjs Array of (flat) timeline objects
 * @param now The time to set the "now":s to
 */
function setNowToTimeInObjects(timelineObjs: Array<TimelineObjGeneric>, now: Time): void {
	// TODO - this should use deNowifyTimeline from pieces.ts instead. This implementation is flawed in that pieceGroups using 'now' will end up being offset about 30 years into the future
	_.each(timelineObjs, (o) => {
		applyToArray(o.enable, (enable) => {
			if (enable.start === 'now') {
				enable.start = now
				enable.setFromNow = true
			}
		})
	})
}

function buildTimelineObjsForRundown(
	context: JobContext,
	cache: CacheForPlayout,
	_activeRundown: DBRundown,
	partInstancesInfo: SelectedPartInstancesTimelineInfo
): (TimelineObjRundown & OnGenerateTimelineObjExt)[] {
	const span = context.startSpan('buildTimelineObjsForRundown')
	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

	const activePlaylist = cache.Playlist.doc
	const currentTime = getCurrentTime()

	timelineObjs.push(
		literal<TimelineObjRundown & OnGenerateTimelineObjExt>({
			id: activePlaylist._id + '_status',
			objectType: TimelineObjType.RUNDOWN,
			enable: { while: 1 },
			layer: 'rundown_status',
			content: {
				deviceType: TSR.DeviceType.ABSTRACT,
			},
			classes: [
				activePlaylist.rehearsal
					? TimelineObjClassesCore.RundownRehearsal
					: TimelineObjClassesCore.RundownActive,
				!activePlaylist.currentPartInstanceId ? TimelineObjClassesCore.BeforeFirstPart : undefined,
				!activePlaylist.nextPartInstanceId ? TimelineObjClassesCore.NoNextPart : undefined,
			].filter((v): v is TimelineObjClassesCore => v !== undefined),
			partInstanceId: null,
		})
	)

	// Fetch the nextPart first, because that affects how the currentPart will be treated
	if (activePlaylist.nextPartInstanceId) {
		// We may be at the end of a show, where there is no next part
		if (!partInstancesInfo.next) throw new Error(`PartInstance "${activePlaylist.nextPartInstanceId}" not found!`)
	}
	if (activePlaylist.currentPartInstanceId) {
		// We may be before the beginning of a show, and there can be no currentPart and we are waiting for the user to Take
		if (!partInstancesInfo.current)
			throw new Error(`PartInstance "${activePlaylist.currentPartInstanceId}" not found!`)
	}
	if (activePlaylist.previousPartInstanceId) {
		// We may be at the beginning of a show, where there is no previous part
		if (!partInstancesInfo.previous)
			logger.warn(`Previous PartInstance "${activePlaylist.previousPartInstanceId}" not found!`)
	}

	if (!partInstancesInfo.next && !partInstancesInfo.current) {
		// maybe at the end of the show
		logger.info(`No next part and no current part set on RundownPlaylist "${activePlaylist._id}".`)
	}

	// Currently playing:
	if (partInstancesInfo.current) {
		const [currentInfinitePieces, currentNormalItems] = _.partition(
			partInstancesInfo.current.pieceInstances,
			(l) => !!(l.infinite && (l.piece.lifespan !== PieceLifespan.WithinPart || l.infinite.fromHold))
		)

		// Find all the infinites in each of the selected parts
		const currentInfinitePieceIds = new Set(
			_.compact(currentInfinitePieces.map((l) => l.infinite?.infiniteInstanceId))
		)
		const nextPartInfinites = new Map<PieceInstanceInfinite['infiniteInstanceId'], PieceInstanceWithTimings>()
		if (partInstancesInfo.current.partInstance.part.autoNext && partInstancesInfo.next) {
			partInstancesInfo.next.pieceInstances.forEach((piece) => {
				if (piece.infinite) {
					nextPartInfinites.set(piece.infinite.infiniteInstanceId, piece)
				}
			})
		}

		const previousPartInfinites: Map<PieceInstanceInfinite['infiniteInstanceId'], PieceInstanceWithTimings> =
			partInstancesInfo.previous
				? normalizeArrayToMapFunc(partInstancesInfo.previous.pieceInstances, (inst) =>
						inst.infinite ? inst.infinite.infiniteInstanceId : undefined
				  )
				: new Map()

		const currentPartInstanceTimings = getPartTimingsOrDefaults(
			partInstancesInfo.current.partInstance,
			partInstancesInfo.current.pieceInstances
		)

		// The startTime of this start is used as the reference point for the calculated timings, so we can use 'now' and everything will lie after this point
		const currentPartEnable: TSR.Timeline.TimelineEnable = { start: 'now' }
		if (partInstancesInfo.current.partInstance.timings?.startedPlayback) {
			// If we are recalculating the currentPart, then ensure it doesnt think it is starting now
			currentPartEnable.start = partInstancesInfo.current.partInstance.timings.startedPlayback
		}

		if (
			partInstancesInfo.next &&
			partInstancesInfo.current.partInstance.part.autoNext &&
			partInstancesInfo.current.partInstance.part.expectedDuration !== undefined
		) {
			// If there is a valid autonext out of the current part, then calculate the duration
			currentPartEnable.duration =
				partInstancesInfo.current.partInstance.part.expectedDuration + currentPartInstanceTimings.toPartDelay
		}
		const currentPartGroup = createPartGroup(partInstancesInfo.current.partInstance, currentPartEnable)

		// Start generating objects
		if (partInstancesInfo.previous) {
			timelineObjs.push(
				...generatePreviousPartInstanceObjects(
					context,
					activePlaylist,
					partInstancesInfo.previous,
					currentInfinitePieceIds,
					currentPartGroup.id,
					currentPartInstanceTimings
				)
			)
		}

		// any continued infinite lines need to skip the group, as they need a different start trigger
		for (const infinitePiece of currentInfinitePieces) {
			timelineObjs.push(
				...generateCurrentInfinitePieceObjects(
					activePlaylist,
					partInstancesInfo.current,
					partInstancesInfo.next,
					previousPartInfinites,
					nextPartInfinites,
					currentPartGroup,
					infinitePiece,
					currentTime,
					currentPartInstanceTimings
				)
			)
		}

		const groupClasses: string[] = ['current_part']
		timelineObjs.push(
			currentPartGroup,
			createPartGroupFirstObject(
				activePlaylist._id,
				partInstancesInfo.current.partInstance,
				currentPartGroup,
				partInstancesInfo.previous?.partInstance
			),
			...transformPartIntoTimeline(
				context,
				activePlaylist._id,
				currentNormalItems,
				groupClasses,
				currentPartGroup,
				partInstancesInfo.current.nowInPart,
				currentPartInstanceTimings,
				activePlaylist.holdState === RundownHoldState.ACTIVE,
				partInstancesInfo.current.partInstance.part.outTransition ?? null
			)
		)

		// only add the next objects into the timeline if the current partgroup has a duration, and can autoNext
		if (partInstancesInfo.next && currentPartEnable.duration) {
			timelineObjs.push(
				...generateNextPartInstanceObjects(
					context,
					activePlaylist,
					partInstancesInfo.current,
					partInstancesInfo.next,
					currentPartGroup
				)
			)
		}
	}

	if (span) span.end()
	return timelineObjs
}

function generateCurrentInfinitePieceObjects(
	activePlaylist: ReadonlyDeep<DBRundownPlaylist>,
	currentPartInfo: SelectedPartInstanceTimelineInfo,
	nextPartInfo: SelectedPartInstanceTimelineInfo | undefined,
	previousPartInfinites: Map<PieceInstanceInfinite['infiniteInstanceId'], PieceInstanceWithTimings>,
	nextPartInfinites: Map<PieceInstanceInfinite['infiniteInstanceId'], PieceInstanceWithTimings>,
	currentPartGroup: TimelineObjGroupPart,
	pieceInstance: PieceInstanceWithTimings,
	currentTime: Time,
	currentPartInstanceTimings: PartCalculatedTimings
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	if (!pieceInstance.infinite) {
		// Type guard, should never be hit
		return []
	}
	if (pieceInstance.disabled || pieceInstance.piece.pieceType !== IBlueprintPieceType.Normal) {
		// Can't be generated as infinites
		return []
	}

	const infiniteGroup = createPartGroup(currentPartInfo.partInstance, {
		start: `#${currentPartGroup.id}.start`, // This gets overriden with a concrete time if the original piece is known to have already started
	})
	infiniteGroup.id = getPartGroupId(protectString<PartInstanceId>(unprotectString(pieceInstance._id))) + '_infinite' // This doesnt want to belong to a part, so force the ids
	infiniteGroup.priority = 1

	const groupClasses: string[] = ['current_part']
	// If the previousPart also contains another segment of this infinite piece, then we label our new one as such
	if (previousPartInfinites.get(pieceInstance.infinite.infiniteInstanceId)) {
		groupClasses.push('continues_infinite')
	}

	let nowInParent = currentPartInfo.nowInPart
	let isAbsoluteInfinitePartGroup = false
	if (pieceInstance.startedPlayback) {
		// Make the start time stick
		infiniteGroup.enable = { start: pieceInstance.startedPlayback }
		nowInParent = currentTime - pieceInstance.startedPlayback
		isAbsoluteInfinitePartGroup = true

		// If an absolute time has been set by a hotkey, then update the duration to be correct
		if (pieceInstance.userDuration && pieceInstance.piece.enable.start !== 'now') {
			infiniteGroup.enable.duration = pieceInstance.userDuration.end - pieceInstance.piece.enable.start
		}
	}

	// If this infinite piece continues to the next part, and has a duration then we should respect that in case it is really close to the take
	const hasDurationOrEnd = (enable: TSR.Timeline.TimelineEnable) =>
		enable.duration !== undefined || enable.end !== undefined
	const infiniteInNextPart = nextPartInfinites.get(pieceInstance.infinite.infiniteInstanceId)
	if (
		infiniteInNextPart &&
		!hasDurationOrEnd(infiniteGroup.enable) &&
		hasDurationOrEnd(infiniteInNextPart.piece.enable)
	) {
		// infiniteGroup.enable.end = infiniteInNextPart.piece.enable.end
		infiniteGroup.enable.duration = infiniteInNextPart.piece.enable.duration
	}

	// If this piece does not continue in the next part, then set it to end with the part it belongs to
	if (nextPartInfo && currentPartInfo.partInstance.part.autoNext && infiniteGroup.enable.duration === undefined) {
		if (pieceInstance.infinite) {
			const infiniteInstanceId = pieceInstance.infinite.infiniteInstanceId
			const nextItem = nextPartInfo.pieceInstances.find(
				(p) => p.infinite && p.infinite.infiniteInstanceId === infiniteInstanceId
			)
			if (!nextItem) {
				infiniteGroup.enable.end = `#${currentPartGroup.id}.end`
			}
		}
	}

	const isInfiniteContinuation =
		pieceInstance.infinite && pieceInstance.piece.startPartId !== currentPartInfo.partInstance.part._id

	let pieceEnable: TSR.Timeline.TimelineEnable
	let pieceStartOffset = 0
	if (isAbsoluteInfinitePartGroup || isInfiniteContinuation) {
		pieceEnable = { start: 0 }

		if (pieceInstance.piece.enable.start !== 'now') pieceStartOffset = pieceInstance.piece.enable.start
	} else {
		pieceEnable = getPieceEnableInsidePart(pieceInstance, currentPartInstanceTimings)
	}

	if (pieceInstance.userDuration) {
		pieceEnable.end = pieceInstance.userDuration.end
		delete pieceEnable.duration
	}

	// Still show objects flagged as 'HoldMode.EXCEPT' if this is a infinite continuation as they belong to the previous too
	const isOriginOfInfinite = pieceInstance.piece.startPartId !== currentPartInfo.partInstance.part._id
	const isInHold = activePlaylist.holdState === RundownHoldState.ACTIVE

	return [
		infiniteGroup,
		...transformPieceGroupAndObjects(
			activePlaylist._id,
			infiniteGroup,
			nowInParent,
			pieceInstance,
			pieceEnable,
			pieceStartOffset,
			groupClasses,
			isInHold,
			isOriginOfInfinite
		),
	]
}

function generatePreviousPartInstanceObjects(
	context: JobContext,
	activePlaylist: ReadonlyDeep<DBRundownPlaylist>,
	previousPartInfo: SelectedPartInstanceTimelineInfo,
	currentInfinitePieceIds: Set<PieceInstanceInfinite['infinitePieceId']>,
	currentPartGroupId: string,
	currentPartInstanceTimings: PartCalculatedTimings
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const partStartedPlayback = previousPartInfo.partInstance.timings?.startedPlayback
	if (partStartedPlayback) {
		// The previous part should continue for a while into the following part
		const prevPartOverlapDuration = currentPartInstanceTimings.fromPartRemaining

		const previousPartGroup = createPartGroup(previousPartInfo.partInstance, {
			start: partStartedPlayback,
			end: `#${currentPartGroupId}.start + ${prevPartOverlapDuration}`,
		})
		previousPartGroup.priority = -1

		// If a Piece is infinite, and continued in the new Part, then we want to add the Piece only there to avoid id collisions
		const previousContinuedPieces = previousPartInfo.pieceInstances.filter(
			(pi) => !pi.infinite || !currentInfinitePieceIds.has(pi.infinite.infiniteInstanceId)
		)

		const groupClasses: string[] = ['previous_part']

		return [
			previousPartGroup,
			...transformPartIntoTimeline(
				context,
				activePlaylist._id,
				previousContinuedPieces,
				groupClasses,
				previousPartGroup,
				previousPartInfo.nowInPart,
				getPartTimingsOrDefaults(previousPartInfo.partInstance, previousPartInfo.pieceInstances),
				activePlaylist.holdState === RundownHoldState.ACTIVE,
				previousPartInfo.partInstance.part.outTransition ?? null
			),
		]
	} else {
		return []
	}
}

function generateNextPartInstanceObjects(
	context: JobContext,
	activePlaylist: ReadonlyDeep<DBRundownPlaylist>,
	currentPartInfo: SelectedPartInstanceTimelineInfo,
	nextPartInfo: SelectedPartInstanceTimelineInfo,
	currentPartGroup: TimelineObjGroupPart
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const currentToNextTimings = calculatePartTimings(
		activePlaylist.holdState,
		currentPartInfo.partInstance.part,
		nextPartInfo.partInstance.part,
		nextPartInfo.pieceInstances
			.filter((p) => !p.infinite || p.infinite.infiniteInstanceIndex === 0)
			.map((p) => p.piece)
	)

	const nextPartGroup = createPartGroup(nextPartInfo.partInstance, {})

	nextPartGroup.enable = {
		start: `#${currentPartGroup.id}.end - ${currentToNextTimings.fromPartRemaining}`,
		duration: nextPartGroup.enable.duration,
	}

	const nextPieceInstances = nextPartInfo?.pieceInstances.filter(
		(i) => !i.infinite || i.infinite.infiniteInstanceIndex === 0
	)

	const groupClasses: string[] = ['next_part']

	return [
		nextPartGroup,
		createPartGroupFirstObject(
			activePlaylist._id,
			nextPartInfo.partInstance,
			nextPartGroup,
			currentPartInfo.partInstance
		),
		...transformPartIntoTimeline(
			context,
			activePlaylist._id,
			nextPieceInstances,
			groupClasses,
			nextPartGroup,
			0,
			currentToNextTimings,
			false,
			nextPartInfo.partInstance.part.outTransition ?? null
		),
	]
}

function createPartGroup(
	partInstance: DBPartInstance,
	enable: TSR.Timeline.TimelineEnable
): TimelineObjGroupPart & OnGenerateTimelineObjExt {
	if (!enable.start) {
		// TODO - is this loose enough?
		enable.start = 'now'
	}
	const partGrp = literal<TimelineObjGroupPart & OnGenerateTimelineObjExt>({
		id: getPartGroupId(partInstance),
		objectType: TimelineObjType.RUNDOWN,
		enable: enable,
		priority: 5,
		layer: '', // These should coexist
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: TimelineContentTypeOther.GROUP,
		},
		children: [],
		isGroup: true,
		isPartGroup: true,
		partInstanceId: partInstance._id,
		metaData: literal<PieceTimelineMetadata>({
			isPieceTimeline: true,
		}),
	})

	return partGrp
}

function createPartGroupFirstObject(
	playlistId: RundownPlaylistId,
	partInstance: DBPartInstance,
	partGroup: TimelineObjRundown & OnGenerateTimelineObjExt,
	previousPart?: DBPartInstance
): TimelineObjPartAbstract & OnGenerateTimelineObjExt {
	return literal<TimelineObjPartAbstract & OnGenerateTimelineObjExt>({
		id: getPartFirstObjectId(partInstance),
		objectType: TimelineObjType.RUNDOWN,
		enable: { start: 0 },
		layer: 'group_first_object',
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: 'callback',
			// Will cause the playout-gateway to run a callback, when the object starts playing:
			callBack: 'partPlaybackStarted',
			callBackData: {
				rundownPlaylistId: playlistId,
				partInstanceId: partInstance._id,
			},
			callBackStopped: 'partPlaybackStopped', // Will cause a callback to be called, when the object stops playing:
		},
		inGroup: partGroup.id,
		partInstanceId: partGroup.partInstanceId,
		classes: (partInstance.part.classes || []).concat(previousPart ? previousPart.part.classesForNext || [] : []),
	})
}

function transformBaselineItemsIntoTimeline(
	objs: RundownBaselineObj[]
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []
	for (const obj of objs) {
		const objects = deserializePieceTimelineObjectsBlob(obj.timelineObjectsString)
		// the baseline objects are layed out without any grouping
		for (const o of objects) {
			timelineObjs.push({
				...o,
				objectType: TimelineObjType.RUNDOWN,
				partInstanceId: null,
			})
		}
	}
	return timelineObjs
}

export function hasPieceInstanceDefinitelyEnded(
	pieceInstance: ReadonlyDeep<PieceInstanceWithTimings>,
	nowInPart: number
): boolean {
	if (nowInPart <= 0) return false
	if (pieceInstance.piece.hasSideEffects || pieceInstance.piece.pieceType === IBlueprintPieceType.OutTransition)
		return false

	let relativeEnd: number | undefined
	if (typeof pieceInstance.resolvedEndCap === 'number') {
		relativeEnd = pieceInstance.resolvedEndCap
	}
	if (pieceInstance.userDuration) {
		relativeEnd =
			relativeEnd === undefined
				? pieceInstance.userDuration.end
				: Math.min(relativeEnd, pieceInstance.userDuration.end)
	}
	if (typeof pieceInstance.piece.enable.start === 'number' && pieceInstance.piece.enable.duration !== undefined) {
		const candidateEnd = pieceInstance.piece.enable.start + pieceInstance.piece.enable.duration
		relativeEnd = relativeEnd === undefined ? candidateEnd : Math.min(relativeEnd, candidateEnd)
	}

	return relativeEnd !== undefined && relativeEnd + DEFINITELY_ENDED_FUTURE_DURATION < nowInPart
}

function getPieceEnableInsidePart(
	pieceInstance: ReadonlyDeep<PieceInstanceWithTimings>,
	partTimings: PartCalculatedTimings
): IBlueprintPiece['enable'] {
	const pieceEnable = { ...pieceInstance.piece.enable }
	if (typeof pieceEnable.start === 'number' && !pieceInstance.adLibSourceId) {
		// timed pieces should be offset based on the preroll of the part
		pieceEnable.start += partTimings.toPartDelay

		if (pieceInstance.piece.prerollDuration) {
			// Offset pre-programmed pieces by their own preroll
			pieceEnable.start -= pieceInstance.piece.prerollDuration

			// Duration needs to be extended to compensate
			if (typeof pieceEnable.duration === 'number') {
				pieceEnable.duration += pieceInstance.piece.prerollDuration
			}
		}
	}
	return pieceEnable
}

function transformPartIntoTimeline(
	context: JobContext,
	playlistId: RundownPlaylistId,
	pieceInstances: ReadonlyDeep<Array<PieceInstanceWithTimings>>,
	pieceGroupFirstObjClasses: string[],
	parentGroup: TimelineObjGroupPart & OnGenerateTimelineObjExt,
	nowInParentGroup: number,
	partTimings: PartCalculatedTimings,
	isInHold: boolean,
	outTransition: IBlueprintPartOutTransition | null
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const span = context.startSpan('transformPartIntoTimeline')
	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

	for (const pieceInstance of pieceInstances) {
		if (pieceInstance.disabled) continue

		let pieceEnable: TSR.Timeline.TimelineEnable | undefined
		switch (pieceInstance.piece.pieceType) {
			case IBlueprintPieceType.InTransition:
				if (typeof partTimings.inTransitionStart === 'number') {
					// Respect the start time of the piece, in case there is a reason for it being non-zero
					const startOffset =
						typeof pieceInstance.piece.enable.start === 'number' ? pieceInstance.piece.enable.start : 0

					pieceEnable = {
						start: partTimings.inTransitionStart + startOffset,
						duration: pieceInstance.piece.enable.duration,
					}
				}
				break
			case IBlueprintPieceType.OutTransition:
				if (outTransition) {
					pieceEnable = {
						start: `#${parentGroup.id}.end - ${outTransition.duration}`,
					}
				}
				break
			case IBlueprintPieceType.Normal:
				pieceEnable = getPieceEnableInsidePart(pieceInstance, partTimings)
				break
			default:
				assertNever(pieceInstance.piece.pieceType)
				break
		}

		// Not able to enable this piece
		if (!pieceEnable) continue

		if (pieceInstance.userDuration) {
			pieceEnable.end = pieceInstance.userDuration.end
			delete pieceEnable.duration
		}

		timelineObjs.push(
			...transformPieceGroupAndObjects(
				playlistId,
				parentGroup,
				nowInParentGroup,
				pieceInstance,
				pieceEnable,
				0,
				pieceGroupFirstObjClasses,
				isInHold,
				false
			)
		)
	}
	if (span) span.end()
	return timelineObjs
}

function transformPieceGroupAndObjects(
	playlistId: RundownPlaylistId,
	partGroup: TimelineObjGroupPart & OnGenerateTimelineObjExt,
	nowInPart: number,
	pieceInstance: ReadonlyDeep<PieceInstanceWithTimings>,
	pieceEnable: TSR.Timeline.TimelineEnable,
	pieceStartOffset: number, // If the start of the piece has been offset inside the partgroup
	firstObjClasses: string[],
	isInHold: boolean,
	includeHoldExceptObjects: boolean
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	// If a piece has definitely finished playback, then we can prune its contents. But we can only do that check if the part has an absolute time, otherwise we are only guessing
	const hasDefinitelyEnded =
		typeof partGroup.enable.start === 'number' && hasPieceInstanceDefinitelyEnded(pieceInstance, nowInPart)

	// create a piece group for the pieces and then place all of them there
	const { pieceGroup, capObjs } = createPieceGroupAndCap(pieceInstance, partGroup, pieceEnable, pieceStartOffset)
	const timelineObjs = [pieceGroup, ...capObjs]

	if (!pieceInstance.piece.virtual && !hasDefinitelyEnded) {
		timelineObjs.push(createPieceGroupFirstObject(playlistId, pieceInstance, pieceGroup, firstObjClasses))

		const pieceObjects: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

		const objects = deserializePieceTimelineObjectsBlob(pieceInstance.piece.timelineObjectsString)
		for (const o of objects) {
			// Some objects can be filtered out at times based on the holdMode of the object
			switch (o.holdMode) {
				case TimelineObjHoldMode.NORMAL:
				case undefined:
					break
				case TimelineObjHoldMode.EXCEPT:
					if (isInHold && !includeHoldExceptObjects) {
						continue
					}
					break
				case TimelineObjHoldMode.ONLY:
					if (!isInHold) {
						continue
					}
					break
				default:
					assertNever(o.holdMode)
			}

			pieceObjects.push({
				...clone<TimelineObjectCoreExt>(o),
				inGroup: pieceGroup.id,
				objectType: TimelineObjType.RUNDOWN,
				pieceInstanceId: unprotectString(pieceInstance._id),
				infinitePieceInstanceId: pieceInstance.infinite?.infiniteInstanceId,
				partInstanceId: partGroup.partInstanceId,
			})
		}

		// This `prefixAllObjectIds` call needs to match the one in, lookahead.ts. If changed then getStartOfObjectRef() will need updating
		timelineObjs.push(...prefixAllObjectIds(pieceObjects, unprotectString(pieceInstance._id)))
	}

	return timelineObjs
}
