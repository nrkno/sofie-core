import {
	Time,
	TimelineObjectCoreExt,
	TimelineObjHoldMode,
	TSR,
	PieceLifespan,
} from '@sofie-automation/blueprints-integration'
import { DeepReadonly } from 'utility-types'
import { logger } from '../../../lib/logging'
import {
	TimelineObjGeneric,
	TimelineObjRundown,
	TimelineObjType,
	TimelineContentTypeOther,
	TimelineObjGroupPart,
	TimelineObjPartAbstract,
	StatObjectMetadata,
	OnGenerateTimelineObjExt,
} from '../../../lib/collections/Timeline'
import { Studio, StudioId } from '../../../lib/collections/Studios'
import { Meteor } from 'meteor/meteor'
import {
	waitForPromise,
	getCurrentTime,
	literal,
	omit,
	unprotectString,
	unprotectObjectArray,
	normalizeArrayFunc,
	clone,
	normalizeArray,
	getRandomId,
	applyToArray,
	protectString,
} from '../../../lib/lib'
import { RundownPlaylist, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { Rundown, RundownHoldState } from '../../../lib/collections/Rundowns'
import { RundownBaselineObj } from '../../../lib/collections/RundownBaselineObjs'
import * as _ from 'underscore'
import { getLookeaheadObjects } from './lookahead'
import { loadStudioBlueprint, loadShowStyleBlueprint } from '../blueprints/cache'
import { StudioContext, TimelineEventContext } from '../blueprints/context'
import { postProcessStudioBaselineObjects } from '../blueprints/postProcess'
import { Part, PartId } from '../../../lib/collections/Parts'
import { prefixAllObjectIds, getSelectedPartInstancesFromCache } from './lib'
import { createPieceGroupFirstObject, getResolvedPiecesFromFullTimeline } from './pieces'
import { PackageInfo } from '../../coreSystem'
import { PartInstance, PartInstanceId, TransformTransitionProps } from '../../../lib/collections/PartInstances'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { CacheForRundownPlaylist, CacheForStudioBase } from '../../DatabaseCaches'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { getExpectedLatency } from '../../../lib/collections/PeripheralDevices'
import { processAndPrunePieceInstanceTimings, PieceInstanceWithTimings } from '../../../lib/rundown/infinites'
import { createPieceGroupAndCap } from '../../../lib/rundown/pieces'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { DEFINITELY_ENDED_FUTURE_DURATION } from './infinites'
import { profiler } from '../profiler'
import { getPartFirstObjectId, getPartGroupId, getPieceGroupId } from '../../../lib/rundown/timeline'

/**
 * Updates the Timeline to reflect the state in the Rundown, Segments, Parts etc...
 * @param studioId id of the studio to update
 * @param forceNowToTime if set, instantly forces all "now"-objects to that time (used in autoNext)
 */
// export const updateTimeline: (cache: CacheForRundownPlaylist, studioId: StudioId, forceNowToTime?: Time) => void
// = syncFunctionIgnore(function updateTimeline (cache: CacheForRundownPlaylist, studioId: StudioId, forceNowToTime?: Time) {
export function updateTimeline(cache: CacheForRundownPlaylist, studioId: StudioId, forceNowToTime?: Time) {
	const span = profiler.startSpan('updateTimeline')
	logger.debug('updateTimeline running...')
	const studio = cache.activationCache.getStudio()
	const activePlaylist = getActiveRundownPlaylist(cache, studioId)

	if (activePlaylist && cache.containsDataFromPlaylist !== activePlaylist._id) {
		throw new Meteor.Error(500, `Active rundownPlaylist is not in cache`)
	}

	if (!studio) throw new Meteor.Error(404, 'studio "' + studioId + '" not found!')

	const timelineObjs: Array<TimelineObjGeneric> = [...getTimelineRundown(cache, studio)]

	processTimelineObjects(studio, timelineObjs)

	/** The timestamp that "now" was set to */
	let theNowTime: number = 0

	if (forceNowToTime) {
		// used when autoNexting
		theNowTime = forceNowToTime
	} else {
		const playoutDevices = waitForPromise(cache.activationCache.getPeripheralDevices()).filter(
			(device) => device.studioId === studioId && device.type === PeripheralDeviceAPI.DeviceType.PLAYOUT
		)
		if (
			playoutDevices.length > 1 || // if we have several playout devices, we can't use the Now feature
			studio.settings.forceSettingNowTime
		) {
			let worstLatency = Math.max(...playoutDevices.map((device) => getExpectedLatency(device).safe))

			/** Add a little more latency, to account for network latency variability */
			const ADD_SAFE_LATENCY = studio.settings.nowSafeLatency || 30
			theNowTime = getCurrentTime() + worstLatency + ADD_SAFE_LATENCY
		}
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

		let tloldo: TimelineObjGeneric | undefined = oldTimelineObjsMap[tlo.id]

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

	cache.Timeline.upsert(
		{
			_id: studio._id,
		},
		{
			_id: studio._id,
			timelineHash: getRandomId(), // randomized on every timeline change
			generated: getCurrentTime(),
			timeline: timelineObjs,
		},
		true
	)

	logger.debug('updateTimeline done!')
	if (span) span.end()
}
// '$1') // This causes syncFunctionIgnore to only use the second argument (studioId) when ignoring

export function getActiveRundownPlaylist(cache: CacheForStudioBase, studioId: StudioId): RundownPlaylist | undefined {
	return cache.RundownPlaylists.findOne({
		studioId: studioId,
		active: true,
	})
}

export interface SelectedPartInstancesTimelineInfo {
	previous?: SelectedPartInstanceTimelineInfo
	current?: SelectedPartInstanceTimelineInfo
	next?: SelectedPartInstanceTimelineInfo
}
export interface SelectedPartInstanceTimelineInfo {
	nowInPart: number
	partInstance: PartInstance
	pieceInstances: PieceInstanceWithTimings[]
}

export function getPartInstanceTimelineInfo(
	cache: CacheForRundownPlaylist,
	currentTime: Time,
	showStyle: ShowStyleBase,
	partInstance: PartInstance | undefined
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
function getTimelineRundown(cache: CacheForRundownPlaylist, studio: Studio): TimelineObjRundown[] {
	const span = profiler.startSpan('getTimelineRundown')
	try {
		let timelineObjs: Array<TimelineObjGeneric & OnGenerateTimelineObjExt> = []

		const playlist = getActiveRundownPlaylist(cache, studio._id) // todo: is this correct?
		let activeRundown: Rundown | undefined

		let currentPartInstance: PartInstance | undefined
		let nextPartInstance: PartInstance | undefined
		let previousPartInstance: PartInstance | undefined

		if (playlist) {
			;({ currentPartInstance, nextPartInstance, previousPartInstance } = getSelectedPartInstancesFromCache(
				cache,
				playlist
			))

			const partForRundown = currentPartInstance || nextPartInstance

			activeRundown = partForRundown && cache.Rundowns.findOne(partForRundown.rundownId)
		}

		if (playlist && activeRundown) {
			// Fetch showstyle blueprint:
			const pShowStyle = cache.activationCache.getShowStyleBase(activeRundown)
			const pshowStyleBlueprint = pShowStyle.then((showStyle) => loadShowStyleBlueprint(showStyle))

			// Fetch baseline
			const baselineItems = cache.RundownBaselineObjs.findFetch({
				rundownId: activeRundown._id,
			})

			const showStyle = waitForPromise(pShowStyle)
			if (!showStyle) {
				throw new Meteor.Error(
					404,
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
			const pLookaheadObjs = getLookeaheadObjects(cache, studio, playlist, partInstancesInfo)

			timelineObjs = timelineObjs.concat(
				buildTimelineObjsForRundown(cache, baselineItems, playlist, partInstancesInfo)
			)

			timelineObjs = timelineObjs.concat(waitForPromise(pLookaheadObjs))

			const showStyleBlueprint0 = waitForPromise(pshowStyleBlueprint)
			const showStyleBlueprintManifest = showStyleBlueprint0.blueprint

			if (showStyleBlueprintManifest.onTimelineGenerate) {
				const context = new TimelineEventContext(
					activeRundown,
					cache,
					previousPartInstance,
					currentPartInstance,
					nextPartInstance
				)
				const resolvedPieces = getResolvedPiecesFromFullTimeline(cache, playlist, timelineObjs)
				try {
					const tlGenRes = waitForPromise(
						showStyleBlueprintManifest.onTimelineGenerate(
							context,
							timelineObjs,
							playlist.previousPersistentState,
							currentPartInstance?.previousPartEndState,
							unprotectObjectArray(resolvedPieces.pieces)
						)
					)
					timelineObjs = _.map(tlGenRes.timeline, (object: OnGenerateTimelineObjExt) => {
						return literal<TimelineObjGeneric & OnGenerateTimelineObjExt>({
							...object,
							objectType: TimelineObjType.RUNDOWN,
						})
					})
					cache.RundownPlaylists.update(playlist._id, {
						$set: {
							previousPersistentState: tlGenRes.persistentState,
							trackedAbSessions: context.knownSessions,
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
			let studioBaseline: TimelineObjRundown[] = []

			const studioBlueprint = loadStudioBlueprint(studio)
			if (studioBlueprint) {
				const blueprint = studioBlueprint.blueprint
				const baselineObjs = blueprint.getBaseline(new StudioContext(studio))
				studioBaseline = postProcessStudioBaselineObjects(studio, baselineObjs)

				const id = `baseline_version`
				studioBaseline.push(
					literal<TimelineObjRundown>({
						id: id,
						objectType: TimelineObjType.RUNDOWN,
						enable: { start: 0 },
						layer: id,
						metaData: literal<StatObjectMetadata>({
							versions: {
								core: PackageInfo.versionExtended || PackageInfo.version,
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

			if (span) span.end()
			return studioBaseline
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
function processTimelineObjects(studio: Studio, timelineObjs: Array<TimelineObjGeneric>): void {
	const span = profiler.startSpan('processTimelineObjects')
	// first, split out any grouped objects, to make the timeline shallow:
	let fixObjectChildren = (o: TimelineObjGeneric): void => {
		// Unravel children objects and put them on the (flat) timelineObjs array
		if (o.isGroup && o.children && o.children.length) {
			_.each(o.children, (child: TSR.TSRTimelineObjBase) => {
				let childFixed: TimelineObjGeneric = {
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
	cache: CacheForRundownPlaylist,
	baselineItems: RundownBaselineObj[],
	activePlaylist: RundownPlaylist,
	partInstancesInfo: SelectedPartInstancesTimelineInfo
): (TimelineObjRundown & OnGenerateTimelineObjExt)[] {
	const span = profiler.startSpan('buildTimelineObjsForRundown')
	let timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []
	let currentPartGroup: (TimelineObjGroupPart & OnGenerateTimelineObjExt) | undefined
	let previousPartGroup: (TimelineObjGroupPart & OnGenerateTimelineObjExt) | undefined

	// const { currentPartInstance, nextPartInstance, previousPartInstance } = getSelectedPartInstancesFromCache(
	// 	cache,
	// 	activePlaylist
	// )

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
			classes: [activePlaylist.rehearsal ? 'rundown_rehersal' : 'rundown_active'],
			partInstanceId: null,
		})
	)

	// Fetch the nextPart first, because that affects how the currentPart will be treated
	if (activePlaylist.nextPartInstanceId) {
		// We may be at the end of a show, where there is no next part
		if (!partInstancesInfo.next)
			throw new Meteor.Error(404, `PartInstance "${activePlaylist.nextPartInstanceId}" not found!`)
	}
	if (activePlaylist.currentPartInstanceId) {
		// We may be before the beginning of a show, and there can be no currentPart and we are waiting for the user to Take
		if (!partInstancesInfo.current)
			throw new Meteor.Error(404, `PartInstance "${activePlaylist.currentPartInstanceId}" not found!`)
	}
	if (activePlaylist.previousPartInstanceId) {
		// We may be at the beginning of a show, where there is no previous part
		if (!partInstancesInfo.previous)
			logger.warning(`Previous PartInstance "${activePlaylist.previousPartInstanceId}" not found!`)
	}

	if (baselineItems) {
		timelineObjs = timelineObjs.concat(transformBaselineItemsIntoTimeline(baselineItems))
	}

	// Currently playing:
	if (partInstancesInfo.current) {
		const [currentInfinitePieces, currentNormalItems] = _.partition(
			partInstancesInfo.current.pieceInstances,
			(l) => !!(l.infinite && (l.piece.lifespan !== PieceLifespan.WithinPart || l.infinite.fromHold))
		)
		const currentInfinitePieceIds = _.compact(currentInfinitePieces.map((l) => l.infinite?.infinitePieceId))

		let allowTransition = false

		if (partInstancesInfo.previous) {
			allowTransition = !partInstancesInfo.previous.partInstance.part.disableOutTransition

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
					previousPartGroupEnable.end = `#${currentPartGroupId}.start + ${partInstancesInfo.previous
						.partInstance.part.autoNextOverlap || 0}`
				}
				previousPartGroup = createPartGroup(partInstancesInfo.previous.partInstance, previousPartGroupEnable)
				previousPartGroup.priority = -1

				// If a Piece is infinite, and continued in the new Part, then we want to add the Piece only there to avoid id collisions
				const previousContinuedPieces = partInstancesInfo.previous.pieceInstances.filter(
					(pi) => !pi.infinite || currentInfinitePieceIds.indexOf(pi.infinite.infinitePieceId) < 0
				)

				const groupClasses: string[] = ['previous_part']
				let prevObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = [previousPartGroup]
				let previousTransProps: TransformTransitionProps | undefined = undefined
				if (partInstancesInfo.previous.partInstance.transProps) {
					previousTransProps = partInstancesInfo.previous.partInstance.transProps
				}
				prevObjs = prevObjs.concat(
					transformPartIntoTimeline(
						activePlaylist._id,
						partInstancesInfo.previous.partInstance.part._id,
						previousContinuedPieces,
						groupClasses,
						previousPartGroup,
						partInstancesInfo.previous.nowInPart,
						false,
						previousTransProps,
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
		const transProps: TransformTransitionProps = {
			allowed: allowTransition,
			preroll: partInstancesInfo.current.partInstance.part.prerollDuration,
			transitionPreroll: partInstancesInfo.current.partInstance.part.transitionPrerollDuration,
			transitionKeepalive: partInstancesInfo.current.partInstance.part.transitionKeepaliveDuration,
		}
		timelineObjs.push(
			currentPartGroup,
			createPartGroupFirstObject(
				activePlaylist._id,
				partInstancesInfo.current.partInstance,
				currentPartGroup,
				partInstancesInfo.previous?.partInstance
			),
			...transformPartIntoTimeline(
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
			let nextPartGroup = createPartGroup(partInstancesInfo.next.partInstance, {})
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
			const transProps: TransformTransitionProps = {
				allowed:
					partInstancesInfo.current.partInstance &&
					!partInstancesInfo.current.partInstance.part.disableOutTransition,
				preroll: partInstancesInfo.next.partInstance.part.prerollDuration,
				transitionPreroll: partInstancesInfo.next.partInstance.part.transitionPrerollDuration,
				transitionKeepalive: partInstancesInfo.next.partInstance.part.transitionKeepaliveDuration,
			}
			timelineObjs.push(
				nextPartGroup,
				createPartGroupFirstObject(
					activePlaylist._id,
					partInstancesInfo.next.partInstance,
					nextPartGroup,
					partInstancesInfo.current.partInstance
				),
				...transformPartIntoTimeline(
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
	partInstance: PartInstance,
	enable: TSR.Timeline.TimelineEnable
): TimelineObjGroupPart & OnGenerateTimelineObjExt {
	if (!enable.start) {
		// TODO - is this loose enough?
		enable.start = 'now'
	}
	let partGrp = literal<TimelineObjGroupPart & OnGenerateTimelineObjExt>({
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
	})

	return partGrp
}
function createPartGroupFirstObject(
	playlistId: RundownPlaylistId,
	partInstance: PartInstance,
	partGroup: TimelineObjRundown & OnGenerateTimelineObjExt,
	previousPart?: PartInstance
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
	let timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []
	_.each(objs, (obj: RundownBaselineObj) => {
		// the baseline objects are layed out without any grouping
		_.each(obj.objects, (o: TimelineObjGeneric) => {
			timelineObjs.push({
				...o,
				objectType: TimelineObjType.RUNDOWN,
				partInstanceId: null,
			})
		})
	})
	return timelineObjs
}

export function hasPieceInstanceDefinitelyEnded(
	pieceInstance: DeepReadonly<PieceInstanceWithTimings>,
	nowInPart: number
): boolean {
	if (nowInPart <= 0) return false

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

function transformPartIntoTimeline(
	playlistId: RundownPlaylistId,
	partId: PartId,
	pieceInstances: DeepReadonly<PieceInstanceWithTimings>[],
	firstObjClasses: string[],
	partGroup: TimelineObjGroupPart & OnGenerateTimelineObjExt,
	nowInPart: number,
	isAbsoluteInfinitePartGroup: boolean,
	transitionProps?: TransformTransitionProps,
	holdState?: RundownHoldState,
	showHoldExcept?: boolean
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const span = profiler.startSpan('transformPartIntoTimeline')
	let timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

	const isHold = holdState === RundownHoldState.ACTIVE
	const allowTransition =
		transitionProps && transitionProps.allowed && !isHold && holdState !== RundownHoldState.COMPLETE
	const transition: DeepReadonly<PieceInstanceWithTimings> | undefined = allowTransition
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

function calcPartKeepaliveDuration(fromPart: Part, toPart: Part, relativeToFrom: boolean): number {
	const allowTransition: boolean = !fromPart.disableOutTransition
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
function calcPartTargetDuration(prevPart: Part | undefined, currentPart: Part): number {
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

	let prerollDuration = currentPart.transitionPrerollDuration || currentPart.prerollDuration || 0
	return rawExpectedDuration + prerollDuration
}
function calcPartOverlapDuration(fromPart: Part, toPart: Part): number {
	const allowTransition: boolean = !fromPart.disableOutTransition
	let overlapDuration: number = toPart.prerollDuration || 0
	if (allowTransition && toPart.transitionPrerollDuration) {
		overlapDuration = calcPartKeepaliveDuration(fromPart, toPart, true)
	}

	if (fromPart.autoNext) {
		overlapDuration += fromPart.autoNextOverlap || 0
	}

	return overlapDuration
}
