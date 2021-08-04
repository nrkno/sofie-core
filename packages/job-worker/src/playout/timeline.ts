// // export async function updateStudioTimeline(cache: CacheForStudio | CacheForPlayout): Promise<void> {
// // 	const span = profiler.startSpan('updateStudioTimeline')
// // 	logger.debug('updateStudioTimeline running...')
// // 	const studio = cache.Studio.doc

import { PartId, PartInstanceId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { JobContext } from '../jobs'
import { ReadonlyDeep } from 'type-fest'
import {
	BlueprintResultBaseline,
	OnGenerateTimelineObj,
	PieceLifespan,
	Time,
	TimelineObjClassesCore,
	TimelineObjectCoreExt,
	TimelineObjHoldMode,
	TSR,
} from '@sofie-automation/blueprints-integration/dist'
import { protectString, unprotectObjectArray, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	OnGenerateTimelineObjExt,
	StatObjectMetadata,
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
	clone,
	getRandomId,
	literal,
	normalizeArray,
	normalizeArrayFunc,
	omit,
} from '@sofie-automation/corelib/dist/lib'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from './cache'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { logger } from '../logging'
import _ = require('underscore')
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { getCurrentTime, getSystemVersion } from '../lib'
import { getPartFirstObjectId, getPartGroupId, getPieceGroupId } from '@sofie-automation/corelib/dist/playout/ids'
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
import { StudioBaselineContext, TimelineEventContext } from '../blueprints/context'
import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { postProcessStudioBaselineObjects } from '../blueprints/postProcess'

// export async function updateStudioOrPlaylistTimeline(cache: CacheForStudio): Promise<void> {
// 	const playlists = cache.getActiveRundownPlaylists()
// 	if (playlists.length === 1) {
// 		return runPlayoutOperationWithCacheFromStudioOperation(
// 			'updateStudioOrPlaylistTimeline',
// 			cache,
// 			playlists[0],
// 			PlayoutLockFunctionPriority.USER_PLAYOUT,
// 			null,
// 			async (playlistCache) => {
// 				await updateTimeline(playlistCache)
// 			}
// 		)
// 	} else {
// 		return updateStudioTimeline(cache)
// 	}
// }

function isCacheForStudio(cache: CacheForStudioBase): cache is CacheForStudio {
	const cache2 = cache as CacheForStudio
	return !!cache2.isStudio
}

export async function updateStudioTimeline(
	context: JobContext,
	cache: CacheForStudio | CacheForPlayout
): Promise<void> {
	const span = context.startSpan('updateStudioTimeline')
	logger.debug('updateStudioTimeline running...')
	const studio = cache.Studio.doc
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
		studioBaseline = blueprint.getBaseline(
			new StudioBaselineContext(
				{ name: 'studioBaseline', identifier: `studioId=${studio._id}` },
				studio,
				context.getStudioBlueprintConfig(),
				watchedPackages
			)
		)
		baselineObjects = postProcessStudioBaselineObjects(studio, studioBaseline.timelineObjects)

		const id = `baseline_version`
		baselineObjects.push(
			literal<TimelineObjRundown>({
				id: id,
				objectType: TimelineObjType.RUNDOWN,
				enable: { start: 0 },
				layer: id,
				metaData: literal<StatObjectMetadata>({
					versions: {
						core: getSystemVersion(),
						blueprintId: studio.blueprintId,
						blueprintVersion: blueprint.blueprintVersion,
						studio: studio._rundownVersionHash,
					},
				}),
				content: {
					deviceType: TSR.DeviceType.ABSTRACT,
				},
			})
		)
	}

	processAndSaveTimelineObjects(context, cache, baselineObjects, undefined)
	if (studioBaseline) {
		// updateBaselineExpectedPackagesOnStudio(cache, studioBaseline) // TODO
	}

	logger.debug('updateStudioTimeline done!')
	if (span) span.end()
}

/**
 * Updates the Timeline to reflect the state in the Rundown, Segments, Parts etc...
 * @param studioId id of the studio to update
 * @param forceNowToTime if set, instantly forces all "now"-objects to that time (used in autoNext)
 */
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

	const timelineObjs: Array<TimelineObjGeneric> = await getTimelineRundown(context, cache)

	processAndSaveTimelineObjects(context, cache, timelineObjs, forceNowToTime)

	if (span) span.end()
}

function processAndSaveTimelineObjects(
	context: JobContext,
	cache: CacheForStudioBase,
	timelineObjs: Array<TimelineObjGeneric>,
	forceNowToTime: Time | undefined
): void {
	const studio = cache.Studio.doc
	processTimelineObjects(context, timelineObjs)

	/** The timestamp that "now" was set to */
	let theNowTime = 0

	if (forceNowToTime) {
		// used when autoNexting
		theNowTime = forceNowToTime
	} else {
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

	const oldTimelineObjsMap = normalizeArray(
		cache.Timeline.findOne({
			_id: studio._id,
		})?.timeline ?? [],
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

	cache.Timeline.replace({
		_id: studio._id,
		timelineHash: getRandomId(), // randomized on every timeline change
		generated: getCurrentTime(),
		timeline: timelineObjs,
	})

	logger.debug('updateTimeline done!')
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
	showStyle: DBShowStyleBase,
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
async function getTimelineRundown(context: JobContext, cache: CacheForPlayout): Promise<Array<TimelineObjRundown>> {
	const span = context.startSpan('getTimelineRundown')
	try {
		let timelineObjs: Array<TimelineObjGeneric & OnGenerateTimelineObjExt> = []

		const { currentPartInstance, nextPartInstance, previousPartInstance } = getSelectedPartInstancesFromCache(cache)

		const partForRundown = currentPartInstance || nextPartInstance
		const activeRundown = partForRundown && cache.Rundowns.findOne(partForRundown.rundownId)

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
			if (blueprint.blueprint.onTimelineGenerate) {
				const context2 = new TimelineEventContext(
					cache.Studio.doc,
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
				try {
					const span = context.startSpan('blueprint.onTimelineGenerate')
					const tlGenRes = await blueprint.blueprint.onTimelineGenerate(
						context2,
						timelineObjs,
						cache.Playlist.doc.previousPersistentState,
						currentPartInstance?.previousPartEndState,
						unprotectObjectArray(resolvedPieces.pieces)
					)
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
				} catch (e) {
					logger.error(`Error in onTimelineGenerate during getTimelineRundown`, e)
				}
			}

			if (span) span.end()
			return timelineObjs.map<TimelineObjRundown>((timelineObj) => {
				return {
					...omit(timelineObj, 'pieceInstanceId', 'infinitePieceInstanceId', 'partInstanceId'), // temporary fields from OnGenerateTimelineObj
					objectType: TimelineObjType.RUNDOWN,
				}
			})
		} else {
			if (span) span.end()
			logger.error('No active rundown during updateTimeline')
			return []
		}
	} catch (e) {
		if (span) span.end()
		logger.error(e)
		return []
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
	let timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []
	let currentPartGroup: (TimelineObjGroupPart & OnGenerateTimelineObjExt) | undefined
	let previousPartGroup: (TimelineObjGroupPart & OnGenerateTimelineObjExt) | undefined

	const activePlaylist = cache.Playlist.doc
	const currentTime = getCurrentTime()

	// let currentPieces: Array<Piece> = []

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

	// Currently playing:
	if (partInstancesInfo.current) {
		const [currentInfinitePieces, currentNormalItems] = _.partition(
			partInstancesInfo.current.pieceInstances,
			(l) => !!(l.infinite && (l.piece.lifespan !== PieceLifespan.WithinPart || l.infinite.fromHold))
		)
		const currentInfinitePieceIds = _.compact(currentInfinitePieces.map((l) => l.infinite?.infinitePieceId))

		if (partInstancesInfo.previous) {
			const previousPartLastStarted = partInstancesInfo.previous.partInstance.timings?.startedPlayback
			if (previousPartLastStarted) {
				const prevPartOverlapDuration = calcPartKeepaliveDuration(
					partInstancesInfo.previous.partInstance.part,
					partInstancesInfo.current.partInstance.part,
					true
				)

				const currentPartGroupId = getPartGroupId(partInstancesInfo.current.partInstance)

				const previousPartGroupEnable = {
					start: previousPartLastStarted,
					end: `#${currentPartGroupId}.start + ${prevPartOverlapDuration}`,
				}
				// If autonext with an overlap, keep the previous line alive for the specified overlap
				if (
					partInstancesInfo.previous.partInstance.part.autoNext &&
					partInstancesInfo.previous.partInstance.part.autoNextOverlap
				) {
					previousPartGroupEnable.end = `#${currentPartGroupId}.start + ${
						partInstancesInfo.previous.partInstance.part.autoNextOverlap || 0
					}`
				}
				previousPartGroup = createPartGroup(partInstancesInfo.previous.partInstance, previousPartGroupEnable)
				previousPartGroup.priority = -1

				// If a Piece is infinite, and continued in the new Part, then we want to add the Piece only there to avoid id collisions
				const previousContinuedPieces = partInstancesInfo.previous.pieceInstances.filter(
					(pi) => !pi.infinite || currentInfinitePieceIds.indexOf(pi.infinite.infinitePieceId) < 0
				)

				const groupClasses: string[] = ['previous_part']
				let prevObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = [previousPartGroup]
				const transProps = getTransformTransitionProps(partInstancesInfo.previous.partInstance)
				prevObjs = prevObjs.concat(
					transformPartIntoTimeline(
						context,
						activePlaylist._id,
						partInstancesInfo.previous.partInstance.part._id,
						previousContinuedPieces,
						groupClasses,
						previousPartGroup,
						partInstancesInfo.previous.nowInPart,
						false,
						transProps,
						activePlaylist.holdState
					)
				)
				timelineObjs = timelineObjs.concat(prevObjs)
			}
		}

		const isFollowed = partInstancesInfo.next && partInstancesInfo.current.partInstance.part.autoNext
		const currentPartEnable = literal<TSR.Timeline.TimelineEnable>({
			duration: !isFollowed
				? undefined
				: calcPartTargetDuration(
						partInstancesInfo.previous?.partInstance.part,
						partInstancesInfo.current.partInstance.part
				  ),
		})
		if (partInstancesInfo.current.partInstance.timings?.startedPlayback) {
			// If we are recalculating the currentPart, then ensure it doesnt think it is starting now
			currentPartEnable.start = partInstancesInfo.current.partInstance.timings.startedPlayback
		}
		currentPartGroup = createPartGroup(partInstancesInfo.current.partInstance, currentPartEnable)

		const nextPartInfinites: { [infiniteId: string]: PieceInstance | undefined } = {}
		if (partInstancesInfo.current.partInstance.part.autoNext && partInstancesInfo.next) {
			partInstancesInfo.next.pieceInstances.forEach((piece) => {
				if (piece.infinite) {
					nextPartInfinites[unprotectString(piece.infinite.infinitePieceId)] = piece
				}
			})
		}

		const previousPartInfinites = partInstancesInfo.previous
			? normalizeArrayFunc(partInstancesInfo.previous.pieceInstances, (inst) =>
					inst.infinite ? unprotectString(inst.infinite.infinitePieceId) : ''
			  )
			: {}

		// any continued infinite lines need to skip the group, as they need a different start trigger
		for (let i = 0; i < currentInfinitePieces.length; i++) {
			const piece = currentInfinitePieces[i]
			if (!piece.infinite) {
				// Type guard, should never be hit
				continue
			}

			const infiniteGroup = createPartGroup(partInstancesInfo.current.partInstance, {
				start: `#${currentPartGroup.id}.start`, // This gets overriden with a concrete time if the original piece is known to have already started
				duration: piece.piece.enable.duration || undefined,
			})
			infiniteGroup.id = getPartGroupId(protectString<PartInstanceId>(unprotectString(piece._id))) + '_infinite' // This doesnt want to belong to a part, so force the ids
			infiniteGroup.priority = 1

			const groupClasses: string[] = ['current_part']
			// If the previousPart also contains another segment of this infinite piece, then we label our new one as such
			if (previousPartInfinites[unprotectString(piece.infinite.infinitePieceId)]) {
				groupClasses.push('continues_infinite')
			}

			let nowInParent = partInstancesInfo.current.nowInPart
			let isAbsoluteInfinitePartGroup = false
			if (piece.startedPlayback) {
				// Make the start time stick
				infiniteGroup.enable = { start: piece.startedPlayback }
				nowInParent = currentTime - piece.startedPlayback
				isAbsoluteInfinitePartGroup = true

				// If an absolute time has been set by a hotkey, then update the duration to be correct
				if (piece.userDuration && piece.piece.enable.start !== 'now') {
					infiniteGroup.enable.duration = piece.userDuration.end - piece.piece.enable.start
				}
			}

			// If this infinite piece continues to the next part, and has a duration then we should respect that in case it is really close to the take
			const hasDurationOrEnd = (enable: TSR.Timeline.TimelineEnable) =>
				enable.duration !== undefined || enable.end !== undefined
			const infiniteInNextPart = nextPartInfinites[unprotectString(piece.infinite.infinitePieceId)]
			if (
				infiniteInNextPart &&
				!hasDurationOrEnd(infiniteGroup.enable) &&
				hasDurationOrEnd(infiniteInNextPart.piece.enable)
			) {
				// infiniteGroup.enable.end = infiniteInNextPart.piece.enable.end
				infiniteGroup.enable.duration = infiniteInNextPart.piece.enable.duration
			}

			// If this piece does not continue in the next part, then set it to end with the part it belongs to
			if (
				partInstancesInfo.next &&
				partInstancesInfo.current.partInstance.part.autoNext &&
				infiniteGroup.enable.duration === undefined
			) {
				const nextPartInstanceId = partInstancesInfo.next.partInstance._id
				const nextItem = cache.PieceInstances.findFetch(
					(p) =>
						p.partInstanceId === nextPartInstanceId &&
						p.infinite &&
						p.infinite.infinitePieceId === piece.infinite?.infinitePieceId
				)
				if (!nextItem) {
					infiniteGroup.enable.end = `#${currentPartGroup.id}.end`
				}
			}

			// Still show objects flagged as 'HoldMode.EXCEPT' if this is a infinite continuation as they belong to the previous too
			const isOriginOfInfinite = piece.piece.startPartId !== partInstancesInfo.current.partInstance.part._id
			timelineObjs = timelineObjs.concat(
				infiniteGroup,
				transformPartIntoTimeline(
					context,
					activePlaylist._id,
					partInstancesInfo.current.partInstance.part._id,
					[piece],
					groupClasses,
					infiniteGroup,
					nowInParent,
					isAbsoluteInfinitePartGroup,
					undefined,
					activePlaylist.holdState,
					isOriginOfInfinite
				)
			)
		}

		const groupClasses: string[] = ['current_part']
		const transProps = getTransformTransitionProps(partInstancesInfo.current.partInstance)
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
				partInstancesInfo.current.partInstance.part._id,
				currentNormalItems,
				groupClasses,
				currentPartGroup,
				partInstancesInfo.current.nowInPart,
				false,
				transProps,
				activePlaylist.holdState
			)
		)

		// only add the next objects into the timeline if the next segment is autoNext
		if (partInstancesInfo.next && partInstancesInfo.current.partInstance.part.autoNext) {
			const nextPartGroup = createPartGroup(partInstancesInfo.next.partInstance, {})
			if (currentPartGroup) {
				const overlapDuration = calcPartOverlapDuration(
					partInstancesInfo.current.partInstance.part,
					partInstancesInfo.next.partInstance.part
				)

				nextPartGroup.enable = {
					start: `#${currentPartGroup.id}.end - ${overlapDuration}`,
					duration: nextPartGroup.enable.duration,
				}
			}

			const nextPieceInstances = partInstancesInfo.next?.pieceInstances.filter(
				(i) => !i.infinite || currentInfinitePieceIds.indexOf(i.infinite.infinitePieceId) === -1
			)

			const groupClasses: string[] = ['next_part']
			const transProps = getTransformTransitionProps(
				partInstancesInfo.next.partInstance,
				!partInstancesInfo.current.partInstance.part.disableOutTransition
			)
			timelineObjs.push(
				nextPartGroup,
				createPartGroupFirstObject(
					activePlaylist._id,
					partInstancesInfo.next.partInstance,
					nextPartGroup,
					partInstancesInfo.current.partInstance
				),
				...transformPartIntoTimeline(
					context,
					activePlaylist._id,
					partInstancesInfo.next.partInstance.part._id,
					nextPieceInstances,
					groupClasses,
					nextPartGroup,
					0,
					false,
					transProps
				)
			)
		}
	}

	if (!partInstancesInfo.next && !partInstancesInfo.current) {
		// maybe at the end of the show
		logger.info(`No next part and no current part set on RundownPlaylist "${activePlaylist._id}".`)
	}

	if (span) span.end()
	return timelineObjs
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
		// the baseline objects are layed out without any grouping
		for (const o of obj.objects) {
			timelineObjs.push({
				...o,
				objectType: TimelineObjType.RUNDOWN,
				partInstanceId: null,
			})
		}
	}
	return timelineObjs
}

interface TransformTransitionProps {
	allowed: boolean
	preroll: number | undefined
	transitionPreroll: number | null | undefined
	transitionKeepalive: number | null | undefined
}

export function hasPieceInstanceDefinitelyEnded(
	pieceInstance: ReadonlyDeep<PieceInstanceWithTimings>,
	nowInPart: number
): boolean {
	if (nowInPart <= 0) return false
	if (pieceInstance.piece.hasSideEffects) return false

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

function getTransformTransitionProps(
	partInstance: DBPartInstance,
	allowTransition?: boolean
): TransformTransitionProps {
	return {
		allowed: allowTransition ?? !!partInstance.allowedToUseTransition,
		preroll: partInstance.part.prerollDuration,
		transitionPreroll: partInstance.part.transitionPrerollDuration,
		transitionKeepalive: partInstance.part.transitionKeepaliveDuration,
	}
}

function transformPartIntoTimeline(
	context: JobContext,
	playlistId: RundownPlaylistId,
	partId: PartId,
	pieceInstances: ReadonlyDeep<Array<PieceInstanceWithTimings>>,
	firstObjClasses: string[],
	partGroup: TimelineObjGroupPart & OnGenerateTimelineObjExt,
	nowInPart: number,
	isAbsoluteInfinitePartGroup: boolean,
	transitionProps?: TransformTransitionProps,
	holdState?: RundownHoldState,
	showHoldExcept?: boolean
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const span = context.startSpan('transformPartIntoTimeline')
	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

	const isHold = holdState === RundownHoldState.ACTIVE
	const allowTransition =
		transitionProps && transitionProps.allowed && !isHold && holdState !== RundownHoldState.COMPLETE
	const transition: ReadonlyDeep<PieceInstanceWithTimings> | undefined = allowTransition
		? pieceInstances.find((i) => !!i.piece.isTransition)
		: undefined
	const transitionPieceDelay = transitionProps
		? Math.max(0, (transitionProps.preroll || 0) - (transitionProps.transitionPreroll || 0))
		: 0
	const transitionContentsDelay = transitionProps
		? (transitionProps.transitionPreroll || 0) - (transitionProps.preroll || 0)
		: 0

	for (const pieceInstance of pieceInstances) {
		if (pieceInstance.disabled) continue
		if (pieceInstance.piece.isTransition && (!allowTransition || isHold)) {
			continue
		}

		// If a piece has definitely finished playback, then we can prune its contents. But we can only do that check if the part has an absolute time, otherwise we are only guessing
		const hasDefinitelyEnded =
			typeof partGroup.enable.start === 'number' && hasPieceInstanceDefinitelyEnded(pieceInstance, nowInPart)

		const isInfiniteContinuation = pieceInstance.infinite && pieceInstance.piece.startPartId !== partId

		const pieceEnable: TSR.Timeline.TimelineEnable = {}
		if (pieceInstance.userDuration) {
			pieceEnable.end = pieceInstance.userDuration.end
		} else {
			pieceEnable.duration = pieceInstance.piece.enable.duration
		}

		let resolvedEndCap = pieceInstance.resolvedEndCap
		if (isAbsoluteInfinitePartGroup) {
			if (typeof resolvedEndCap === 'number') {
				// If we have a real end cap, then offset the end to compensate for the forced 0 start
				resolvedEndCap -=
					pieceInstance.piece.enable.start === 'now' ? nowInPart : pieceInstance.piece.enable.start
			}

			pieceEnable.start = 0
		} else {
			pieceEnable.start = pieceInstance.piece.enable.start

			if (pieceEnable.start === 0 && !isInfiniteContinuation) {
				// If timed absolute and there is a transition delay, then apply delay
				if (
					!pieceInstance.piece.isTransition &&
					allowTransition &&
					transition &&
					!pieceInstance.adLibSourceId
				) {
					const transitionContentsDelayStr =
						transitionContentsDelay < 0 ? `- ${-transitionContentsDelay}` : `+ ${transitionContentsDelay}`
					pieceEnable.start = `#${getPieceGroupId(transition)}.start ${transitionContentsDelayStr}`
				} else if (pieceInstance.piece.isTransition && transitionPieceDelay) {
					pieceEnable.start = Math.max(0, transitionPieceDelay)
				}
			}
		}

		// create a piece group for the pieces and then place all of them there
		const { pieceGroup, capObjs } = createPieceGroupAndCap(
			{ ...pieceInstance, resolvedEndCap },
			partGroup,
			pieceEnable
		)
		timelineObjs.push(pieceGroup)
		timelineObjs.push(...capObjs)

		if (!pieceInstance.piece.virtual && pieceInstance.piece.content?.timelineObjects && !hasDefinitelyEnded) {
			timelineObjs.push(createPieceGroupFirstObject(playlistId, pieceInstance, pieceGroup, firstObjClasses))

			const pieceObjects: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

			for (const o of pieceInstance.piece.content.timelineObjects) {
				if (o.holdMode) {
					if (isHold && !showHoldExcept && o.holdMode === TimelineObjHoldMode.EXCEPT) {
						continue
					}
					if (!isHold && o.holdMode === TimelineObjHoldMode.ONLY) {
						continue
					}
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

			// TODO - should this be ignoreOriginal? this used to be setting that for the previousPartInstance. If changing, lookahead.ts getStartOfObjectRef() will need updating
			timelineObjs.push(...prefixAllObjectIds(pieceObjects, unprotectString(pieceInstance._id)))
		}
	}
	if (span) span.end()
	return timelineObjs
}

function calcPartKeepaliveDuration(fromPart: DBPart, toPart: DBPart, relativeToFrom: boolean): number {
	const allowTransition = !fromPart.disableOutTransition
	if (!allowTransition) {
		return fromPart.autoNextOverlap || 0
	}

	if (relativeToFrom) {
		// TODO remove
		if (toPart.transitionKeepaliveDuration === undefined || toPart.transitionKeepaliveDuration === null) {
			return toPart.prerollDuration || 0
		}

		const transPieceDelay = Math.max(0, (toPart.prerollDuration || 0) - (toPart.transitionPrerollDuration || 0))
		return transPieceDelay + (toPart.transitionKeepaliveDuration || 0)
	}

	// if (toPart.transitionKeepaliveDuration === undefined || toPart.transitionKeepaliveDuration === null) {
	// 	return (fromPart.autoNextOverlap || 0)
	// }

	return 0
}
function calcPartTargetDuration(prevPart: DBPart | undefined, currentPart: DBPart): number {
	if (currentPart.expectedDuration === undefined) {
		return 0
	}

	// This is a horrible hack, to compensate for the expectedDuration mangling in the blueprints which is
	// needed to get the show runtime to be correct. This just inverts that mangling before running as 'intended'
	const maxPreroll = Math.max(
		currentPart.transitionPrerollDuration ? currentPart.transitionPrerollDuration : 0,
		currentPart.prerollDuration || 0
	)
	const maxKeepalive = Math.max(
		currentPart.transitionKeepaliveDuration ? currentPart.transitionKeepaliveDuration : 0,
		currentPart.prerollDuration || 0
	)
	const lengthAdjustment = maxPreroll - maxKeepalive
	const rawExpectedDuration =
		(currentPart.expectedDuration || 0) - lengthAdjustment + (currentPart.autoNextOverlap || 0)

	if (!prevPart || prevPart.disableOutTransition) {
		return rawExpectedDuration + (currentPart.prerollDuration || 0)
	}

	const prerollDuration = currentPart.transitionPrerollDuration || currentPart.prerollDuration || 0
	return rawExpectedDuration + prerollDuration
}
function calcPartOverlapDuration(fromPart: DBPart, toPart: DBPart): number {
	const allowTransition = !fromPart.disableOutTransition
	let overlapDuration: number = toPart.prerollDuration || 0
	if (allowTransition && toPart.transitionPrerollDuration) {
		overlapDuration = calcPartKeepaliveDuration(fromPart, toPart, true)
	}

	if (fromPart.autoNext) {
		overlapDuration += fromPart.autoNextOverlap || 0
	}

	return overlapDuration
}
