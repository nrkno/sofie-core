import { syncFunctionIgnore } from '../../codeControl'
import {
	Time,
	getPartGroupId,
	getPartFirstObjectId,
	TimelineObjectCoreExt,
	getPieceGroupId,
	TimelineObjHoldMode,
	OnGenerateTimelineObj,
	PlayoutTimelinePrefixes
} from 'tv-automation-sofie-blueprints-integration'
import { logger } from '../../../lib/logging'
import {
	TimelineObjGeneric,
	Timeline,
	TimelineObjRundown,
	TimelineObjStat,
	TimelineObjType,
	TimelineContentTypeOther,
	TimelineObjRecording,
	TimelineObjGroupPart,
	TimelineObjPartAbstract,
	getTimelineId,
	fixTimelineId
} from '../../../lib/collections/Timeline'
import { Studios,
	Studio } from '../../../lib/collections/Studios'
import { Meteor } from 'meteor/meteor'
import {
	waitForPromiseAll,
	caught,
	makePromise,
	saveIntoDb,
	asyncCollectionFindOne,
	waitForPromise,
	asyncCollectionRemove,
	asyncCollectionFindFetch,
	getHash,
	stringifyObjects,
	getCurrentTime,
	asyncCollectionUpsert,
	extendMandadory,
	literal,
	clone,
	omit
} from '../../../lib/lib'
import { Rundowns, RundownData, Rundown, RundownHoldState } from '../../../lib/collections/Rundowns'
import { RundownBaselineObj, RundownBaselineObjs } from '../../../lib/collections/RundownBaselineObjs'
import {
	Timeline as TimelineTypes,
	DeviceType,
	TSRTimelineObjBase
} from 'timeline-state-resolver-types'
import * as _ from 'underscore'
import { getLookeaheadObjects } from './lookahead'
import { loadStudioBlueprints, getBlueprintOfRundown } from '../blueprints/cache'
import { StudioContext, RundownContext, PartEventContext } from '../blueprints/context'
import { postProcessStudioBaselineObjects } from '../blueprints/postProcess'
import { RecordedFiles } from '../../../lib/collections/RecordedFiles'
import { generateRecordingTimelineObjs } from '../testTools'
import { Part } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import { prefixAllObjectIds } from './lib'
import { createPieceGroup, createPieceGroupFirstObject, getResolvedPieces, getResolvedPiecesFromFullTimeline } from './pieces'
import { PackageInfo } from '../../coreSystem'
import { offsetTimelineEnableExpression } from '../../../lib/Rundown'

/**
 * Updates the Timeline to reflect the state in the Rundown, Segments, Parts etc...
 * @param studioId id of the studio to update
 * @param forceNowToTime if set, instantly forces all "now"-objects to that time (used in autoNext)
 */
export const updateTimeline: (studioId: string, forceNowToTime?: Time) => void
= syncFunctionIgnore(function updateTimeline (studioId: string, forceNowToTime?: Time) {
	logger.debug('updateTimeline running...')
	let timelineObjs: Array<TimelineObjGeneric> = []

	let studio = Studios.findOne(studioId) as Studio
	if (!studio) throw new Meteor.Error(404, 'studio "' + studioId + '" not found!')

	const applyTimelineObjs = (_timelineObjs: TimelineObjGeneric[]) => {
		timelineObjs = timelineObjs.concat(_timelineObjs)
	}

	waitForPromiseAll([
		caught(getTimelineRundown(studio).then(applyTimelineObjs)),
		caught(getTimelineRecording(studio).then(applyTimelineObjs))
	])

	processTimelineObjects(studio, timelineObjs)

	if (forceNowToTime) { // used when autoNexting
		setNowToTimeInObjects(timelineObjs, forceNowToTime)
	}

	let savedTimelineObjs: TimelineObjGeneric[] = []
	saveIntoDb<TimelineObjGeneric, TimelineObjGeneric>(Timeline, {
		studioId: studio._id,
		objectType: { $ne: TimelineObjType.STAT }
	}, timelineObjs, {
		beforeUpdate: (o: TimelineObjGeneric, oldO: TimelineObjGeneric): TimelineObjGeneric => {
			// do not overwrite enable when the enable has been denowified
			if (o.enable.start === 'now' && oldO.enable.setFromNow) {
				o.enable.start = oldO.enable.start
				o.enable.setFromNow = true
			}
			savedTimelineObjs.push(o)
			return o
		},
		afterInsert: (o: TimelineObjGeneric) => {
			savedTimelineObjs.push(o)
		}
	})

	afterUpdateTimeline(studio, savedTimelineObjs)

	logger.debug('updateTimeline done!')
})
/**
 * To be called after an update to the timeline has been made, will add/update the "statObj" - an object
 * containing the hash of the timeline, used to determine if the timeline should be updated in the gateways
 * @param studioId id of the studio to update
 */
export function afterUpdateTimeline (studio: Studio, timelineObjs?: Array<TimelineObjGeneric>) {

	// logger.info('afterUpdateTimeline')
	if (!timelineObjs) {
		timelineObjs = Timeline.find({
			studioId: studio._id,
			objectType: { $ne: TimelineObjType.STAT }
		}).fetch()
	}

	// Number of objects
	let objCount = timelineObjs.length
	// Hash of all objects
	timelineObjs = timelineObjs.sort((a, b) => {
		if (a._id < b._id) return 1
		if (a._id > b._id) return -1
		return 0
	})
	let objHash = getHash(stringifyObjects(timelineObjs))

	// save into "magic object":
	let statObj: TimelineObjStat = {
		id: 'statObj',
		_id: '', // set later
		studioId: studio._id,
		objectType: TimelineObjType.STAT,
		content: {
			deviceType: DeviceType.ABSTRACT,
			type: TimelineContentTypeOther.NOTHING,
			modified: getCurrentTime(),
			objCount: objCount,
			objHash: objHash
		},
		enable: { start: 0 },
		layer: '__stat'
	}
	statObj._id = getTimelineId(statObj)

	waitForPromise(asyncCollectionUpsert(Timeline, statObj._id, { $set: statObj }))
}
/**
 * Returns timeline objects related to rundowns in a studio
 */
function getTimelineRundown (studio: Studio): Promise<TimelineObjRundown[]> {

	return new Promise((resolve, reject) => {
		try {
			let timelineObjs: Array<TimelineObjGeneric & OnGenerateTimelineObj> = []

			const promiseActiveRundown = asyncCollectionFindOne(Rundowns, {
				studioId: studio._id,
				active: true
			})
			// let promiseStudio = asyncCollectionFindOne(Studios, studio._id)
			let activeRundown = waitForPromise(promiseActiveRundown)

			if (activeRundown) {

				// remove anything not related to active rundown:
				let promiseClearTimeline: Promise<void> = asyncCollectionRemove(Timeline, {
					studioId: studio._id,
					rundownId: {
						$not: {
							$eq: activeRundown._id
						}
					}
				})
				// Start with fetching stuff from database:
				let promiseBaselineItems: Promise<Array<RundownBaselineObj>> = asyncCollectionFindFetch(RundownBaselineObjs, {
					rundownId: activeRundown._id
				})
				let rundownData: RundownData = activeRundown.fetchAllData()

				// Default timelineobjects:
				let baselineItems = waitForPromise(promiseBaselineItems)

				timelineObjs = timelineObjs.concat(buildTimelineObjsForRundown(rundownData, baselineItems))

				// next (on pvw (or on pgm if first))
				timelineObjs = timelineObjs.concat(getLookeaheadObjects(rundownData, studio))

				const showStyleBlueprint = getBlueprintOfRundown(activeRundown).blueprint
				if (showStyleBlueprint.onTimelineGenerate && rundownData.rundown.currentPartId) {
					const currentPart = rundownData.partsMap[rundownData.rundown.currentPartId]
					const context = new PartEventContext(activeRundown, studio, currentPart)
					// const resolvedPieces = getResolvedPieces(currentPart)
					const resolvedPieces = getResolvedPiecesFromFullTimeline(rundownData, timelineObjs)
					const tlGenRes = waitForPromise(showStyleBlueprint.onTimelineGenerate(context, timelineObjs, rundownData.rundown.previousPersistentState, currentPart.previousPartEndState, resolvedPieces.pieces))
					timelineObjs = _.map(tlGenRes.timeline, (object: OnGenerateTimelineObj) => {
						return literal<TimelineObjGeneric & OnGenerateTimelineObj>({
							...object,
							_id: '', // set later
							objectType: TimelineObjType.RUNDOWN,
							studioId: studio._id
						})
					})
					// TODO - is this the best place for this save?
					if (tlGenRes.persistentState) {
						Rundowns.update(rundownData.rundown._id, {
							$set: {
								previousPersistentState: tlGenRes.persistentState
							}
						})
					}
				}

				waitForPromise(promiseClearTimeline)

				resolve(
					_.map<TimelineObjGeneric & OnGenerateTimelineObj, TimelineObjRundown>(timelineObjs, (timelineObj) => {
						return {
							...omit(timelineObj, 'pieceId', 'infinitePieceId'), // temporary fields from OnGenerateTimelineObj
							rundownId: activeRundown._id,
							objectType: TimelineObjType.RUNDOWN
						}
					})
				)
			} else {
				let studioBaseline: TimelineObjRundown[] = []

				const studioBlueprint = loadStudioBlueprints(studio)
				if (studioBlueprint) {
					const blueprint = studioBlueprint.blueprint
					const baselineObjs = blueprint.getBaseline(new StudioContext(studio))
					studioBaseline = postProcessStudioBaselineObjects(studio, baselineObjs)

					const id = `baseline_version`
					studioBaseline.push(literal<TimelineObjRundown>({
						id: id,
						_id: '', // set later
						studioId: '', // set later
						rundownId: '',
						objectType: TimelineObjType.RUNDOWN,
						enable: { start: 0 },
						layer: id,
						metadata: {
							versions: {
								core: PackageInfo.version,
								blueprintId: studio.blueprintId,
								blueprintVersion: blueprint.blueprintVersion,
								studio: studio._rundownVersionHash,
							}
						},
						content: {
							deviceType: DeviceType.ABSTRACT
						}
					}))
				}

				resolve(studioBaseline)
			}
		} catch (e) {
			reject(e)
		}
	})

}
/**
 * Returns timeline objects related to Test Recordings in a studio
 */
function getTimelineRecording (studio: Studio, forceNowToTime?: Time): Promise<TimelineObjRecording[]> {

	return new Promise((resolve, reject) => {
		try {
			let recordingTimelineObjs: TimelineObjRecording[] = []

			RecordedFiles.find({ // TODO: ask Julian if this is okay, having multiple recordings at the same time?
				studioId: studio._id,
				stoppedAt: { $exists: false }
			}, {
				sort: {
					startedAt: 1 // TODO - is order correct?
				}
			}).forEach((activeRecording) => {
				recordingTimelineObjs = recordingTimelineObjs.concat(
					generateRecordingTimelineObjs(studio, activeRecording)
				)
			})

			resolve(recordingTimelineObjs)
		} catch (e) {
			reject(e)
		}
	})
	// Timeline.remove({
	// 	siId: studioId,
	// 	recordingObject: true
	// })
}
/**
 * Fix the timeline objects, adds properties like deviceId and studioId to the timeline objects
 * @param studio
 * @param timelineObjs Array of timeline objects
 */
function processTimelineObjects (studio: Studio, timelineObjs: Array<TimelineObjGeneric>): void {
	// first, split out any grouped objects, to make the timeline shallow:
	let fixObjectChildren = (o: TimelineObjGeneric): void => {
		// Unravel children objects and put them on the (flat) timelineObjs array
		if (o.isGroup && o.children && o.children.length) {

			_.each(o.children, (child: TSRTimelineObjBase) => {

				let childFixed: TimelineObjGeneric = {
					...child,
					_id: '', // set later
					studioId: o.studioId,
					objectType: o.objectType,
					inGroup: o.id
				}
				if (!childFixed.id) logger.error(`TimelineObj missing id attribute (child of ${o._id})`, childFixed)
				childFixed._id = getTimelineId(childFixed)
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
		o.studioId = studio._id
		o._id = getTimelineId(o)
		fixObjectChildren(o)
	})
}
/**
 * goes through timelineObjs and forces the "now"-values to the absolute time specified
 * @param timelineObjs Array of (flat) timeline objects
 * @param now The time to set the "now":s to
 */
function setNowToTimeInObjects (timelineObjs: Array<TimelineObjGeneric>, now: Time): void {
	_.each(timelineObjs, (o) => {
		if (o.enable.start === 'now'
		) {
			o.enable.start = now
			o.enable.setFromNow = true
		}
	})
}

function buildTimelineObjsForRundown (rundownData: RundownData, baselineItems: RundownBaselineObj[]): (TimelineObjRundown & OnGenerateTimelineObj)[] {
	let timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObj> = []
	let currentPartGroup: TimelineObjRundown | undefined
	let previousPartGroup: TimelineObjRundown | undefined

	let currentPart: Part | undefined
	let nextPart: Part | undefined

	// let currentPieces: Array<Piece> = []
	let previousPart: Part | undefined

	let activeRundown = rundownData.rundown

	timelineObjs.push(literal<TimelineObjRundown>({
		id: activeRundown._id + '_status',
		_id: '', // set later
		studioId: '', // set later
		objectType: TimelineObjType.RUNDOWN,
		rundownId: rundownData.rundown._id,
		enable: { while: 1 },
		layer: 'rundown_status',
		content: {
			deviceType: DeviceType.ABSTRACT
		},
		classes: [activeRundown.rehearsal ? 'rundown_rehersal' : 'rundown_active']
	}))

	// Fetch the nextPart first, because that affects how the currentPart will be treated
	if (activeRundown.nextPartId) {
		// We may be at the beginning of a show, and there can be no currentPart and we are waiting for the user to Take
		nextPart = rundownData.partsMap[activeRundown.nextPartId]
		if (!nextPart) throw new Meteor.Error(404, `Part "${activeRundown.nextPartId}" not found!`)
	}

	if (activeRundown.currentPartId) {
		currentPart = rundownData.partsMap[activeRundown.currentPartId]
		if (!currentPart) throw new Meteor.Error(404, `Part "${activeRundown.currentPartId}" not found!`)

		if (activeRundown.previousPartId) {
			previousPart = rundownData.partsMap[activeRundown.previousPartId]
			if (!previousPart) throw new Meteor.Error(404, `Part "${activeRundown.previousPartId}" not found!`)
		}
	}

	if (baselineItems) {
		timelineObjs = timelineObjs.concat(transformBaselineItemsIntoTimeline(rundownData.rundown, baselineItems))
	}

	// Currently playing:
	if (currentPart) {

		const currentPieces = currentPart.getAllPieces()
		const currentInfinitePieces = currentPieces.filter(l => (l.infiniteMode && l.infiniteId && l.infiniteId !== l._id))
		const currentNormalItems = currentPieces.filter(l => !(l.infiniteMode && l.infiniteId && l.infiniteId !== l._id))

		let allowTransition = false

		if (previousPart) {
			allowTransition = !previousPart.disableOutTransition

			if (previousPart.getLastStartedPlayback()) {
				const prevPartOverlapDuration = calcPartKeepaliveDuration(previousPart, currentPart, true)
				const previousPartGroupEnable = {
					start: previousPart.getLastStartedPlayback() || 0,
					end: `#${getPartGroupId(currentPart)}.start + ${prevPartOverlapDuration}`
				}
				// If autonext with an overlap, keep the previous line alive for the specified overlap
				if (previousPart.autoNext && previousPart.autoNextOverlap) {
					previousPartGroupEnable.end = `#${getPartGroupId(currentPart)}.start + ${previousPart.autoNextOverlap || 0}`
				}
				previousPartGroup = createPartGroup(previousPart, previousPartGroupEnable)
				previousPartGroup.priority = -1

				// If a Piece is infinite, and continued in the new Part, then we want to add the Piece only there to avoid id collisions
				const skipIds = currentInfinitePieces.map(l => l.infiniteId || '')
				const previousPieces = previousPart.getAllPieces().filter(l => !l.infiniteId || skipIds.indexOf(l.infiniteId) < 0)

				const groupClasses: string[] = ['previous_part']
				let prevObjs: TimelineObjRundown[] = [previousPartGroup]
				prevObjs = prevObjs.concat(
					transformPartIntoTimeline(rundownData.rundown, previousPieces, groupClasses, previousPartGroup, undefined, activeRundown.holdState, undefined))

				prevObjs = prefixAllObjectIds(prevObjs, 'previous_')

				timelineObjs = timelineObjs.concat(prevObjs)
			}
		}

		// fetch pieces
		// fetch the timelineobjs in pieces
		const isFollowed = nextPart && currentPart.autoNext
		const currentPartEnable = literal<TimelineTypes.TimelineEnable>({
			duration: !isFollowed ? undefined : calcPartTargetDuration(previousPart, currentPart)
		})
		if (currentPart.startedPlayback && currentPart.getLastStartedPlayback()) { // If we are recalculating the currentPart, then ensure it doesnt think it is starting now
			currentPartEnable.start = currentPart.getLastStartedPlayback() || 0
		}
		currentPartGroup = createPartGroup(currentPart, currentPartEnable)

		// any continued infinite lines need to skip the group, as they need a different start trigger
		for (let piece of currentInfinitePieces) {
			const infiniteGroup = createPartGroup(currentPart, { duration: piece.enable.duration || undefined })
			infiniteGroup.id = getPartGroupId(piece._id) + '_infinite'
			infiniteGroup.priority = 1

			const groupClasses: string[] = ['current_part']
			// If the previousPart also contains another segment of this infinite piece, then we label our new one as such
			if (previousPart && previousPart.getAllPieces().filter(i => i.infiniteId && i.infiniteId === piece.infiniteId)) {
				groupClasses.push('continues_infinite')
			}

			if (piece.infiniteId) {
				const originalItem = _.find(rundownData.pieces, (p => p._id === piece.infiniteId))

				// If we are a continuation, set the same start point to ensure that anything timed is correct
				if (originalItem && originalItem.startedPlayback) {
					infiniteGroup.enable = { start: originalItem.startedPlayback }

					// If an absolute time has been set by a hotkey, then update the duration to be correct
					const partStartedPlayback = currentPart.getLastStartedPlayback()
					if (piece.userDuration && partStartedPlayback) {
						const previousPartsDuration = (partStartedPlayback - originalItem.startedPlayback)
						if (piece.userDuration.end) {
							infiniteGroup.enable.end = piece.userDuration.end
						} else {
							infiniteGroup.enable.duration = offsetTimelineEnableExpression(piece.userDuration.duration, previousPartsDuration)
						}
					}
				}
			}

			// Still show objects flagged as 'HoldMode.EXCEPT' if this is a infinite continuation as they belong to the previous too
			const showHoldExcept = piece.infiniteId !== piece._id
			timelineObjs = timelineObjs.concat(infiniteGroup, transformPartIntoTimeline(rundownData.rundown, [piece], groupClasses, infiniteGroup, undefined, activeRundown.holdState, showHoldExcept))
		}

		const groupClasses: string[] = ['current_part']
		const transProps: TransformTransitionProps = {
			allowed: allowTransition,
			preroll: currentPart.prerollDuration,
			transitionPreroll: currentPart.transitionPrerollDuration,
			transitionKeepalive: currentPart.transitionKeepaliveDuration
		}
		timelineObjs = timelineObjs.concat(
			currentPartGroup,
			transformPartIntoTimeline(rundownData.rundown, currentNormalItems, groupClasses, currentPartGroup, transProps, activeRundown.holdState, undefined)
		)

		timelineObjs.push(createPartGroupFirstObject(currentPart, currentPartGroup, previousPart))

		// only add the next objects into the timeline if the next segment is autoNext
		if (nextPart && currentPart.autoNext) {
			// console.log('This part will autonext')
			let nextPieceGroup = createPartGroup(nextPart, {})
			if (currentPartGroup) {
				const overlapDuration = calcPartOverlapDuration(currentPart, nextPart)

				nextPieceGroup.enable = {
					start: `#${currentPartGroup.id}.end - ${overlapDuration}`,
					duration: nextPieceGroup.enable.duration
				}
				if (typeof nextPieceGroup.enable.duration === 'number') {
					nextPieceGroup.enable.duration += currentPart.autoNextOverlap || 0
				}
			}

			let toSkipIds = currentPieces.filter(i => i.infiniteId).map(i => i.infiniteId)

			let nextItems = nextPart.getAllPieces()
			nextItems = nextItems.filter(i => !i.infiniteId || toSkipIds.indexOf(i.infiniteId) === -1)

			const groupClasses: string[] = ['next_part']
			const transProps: TransformTransitionProps = {
				allowed: currentPart && !currentPart.disableOutTransition,
				preroll: nextPart.prerollDuration,
				transitionPreroll: nextPart.transitionPrerollDuration,
				transitionKeepalive: nextPart.transitionKeepaliveDuration
			}
			timelineObjs = timelineObjs.concat(
				nextPieceGroup,
				transformPartIntoTimeline(rundownData.rundown, nextItems, groupClasses, nextPieceGroup, transProps)
			)
			timelineObjs.push(createPartGroupFirstObject(nextPart, nextPieceGroup, currentPart))
		}
	}

	if (!nextPart && !currentPart) {
		// maybe at the end of the show
		logger.info(`No next part and no current part set on rundown "${activeRundown._id}".`)
	}

	return timelineObjs
}
function createPartGroup (part: Part, enable: TimelineTypes.TimelineEnable): TimelineObjGroupPart & TimelineObjRundown {
	if (!enable.start) { // TODO - is this loose enough?
		enable.start = 'now'
	}
	let partGrp = literal<TimelineObjGroupPart>({
		id: getPartGroupId(part),
		_id: '', // set later
		studioId: '', // set later
		rundownId: part.rundownId,
		objectType: TimelineObjType.RUNDOWN,
		enable: enable,
		priority: 5,
		layer: '', // These should coexist
		content: {
			deviceType: DeviceType.ABSTRACT,
			type: TimelineContentTypeOther.GROUP
		},
		children: [],
		isGroup: true,
		isPartGroup: true,
	})

	return partGrp
}
function createPartGroupFirstObject (
	part: Part,
	partGroup: TimelineObjRundown,
	previousPart?: Part
): TimelineObjPartAbstract {
	return literal<TimelineObjPartAbstract>({
		id: getPartFirstObjectId(part),
		_id: '', // set later
		studioId: '', // set later
		rundownId: part.rundownId,
		objectType: TimelineObjType.RUNDOWN,
		enable: { start: 0 },
		layer: 'group_first_object',
		content: {
			deviceType: DeviceType.ABSTRACT,
			type: 'callback',
			// Will cause the playout-gateway to run a callback, when the object starts playing:
			callBack: 'partPlaybackStarted',
			callBackData: {
				rundownId: part.rundownId,
				partId: part._id
			},
			callBackStopped: 'partPlaybackStopped' // Will cause a callback to be called, when the object stops playing:
		},
		inGroup: partGroup.id,
		classes: (part.classes || []).concat(previousPart ? previousPart.classesForNext || [] : [])
	})
}

function transformBaselineItemsIntoTimeline (rundown: Rundown, objs: RundownBaselineObj[]): Array<TimelineObjRundown> {
	let timelineObjs: Array<TimelineObjRundown> = []
	_.each(objs, (obj: RundownBaselineObj) => {
		// the baseline objects are layed out without any grouping
		_.each(obj.objects, (o: TimelineObjGeneric) => {
			fixTimelineId(o)
			timelineObjs.push(extendMandadory<TimelineObjGeneric, TimelineObjRundown>(o, {
				rundownId: rundown._id,
				objectType: TimelineObjType.RUNDOWN
			}))
		})
	})
	return timelineObjs
}

interface TransformTransitionProps {
	allowed: boolean
	preroll?: number
	transitionPreroll?: number | null
	transitionKeepalive?: number | null
}

function transformPartIntoTimeline (
	rundown: Rundown,
	pieces: Piece[],
	firstObjClasses: string[],
	partGroup?: TimelineObjRundown,
	transitionProps?: TransformTransitionProps,
	holdState?: RundownHoldState,
	showHoldExcept?: boolean
): Array<TimelineObjRundown & OnGenerateTimelineObj> {
	let timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObj> = []

	const isHold = holdState === RundownHoldState.ACTIVE
	const allowTransition = transitionProps && transitionProps.allowed && !isHold && holdState !== RundownHoldState.COMPLETE
	const transition: Piece | undefined = allowTransition ? clone(pieces.find(i => !!i.isTransition)) : undefined
	const transitionPieceDelay = transitionProps ? Math.max(0, (transitionProps.preroll || 0) - (transitionProps.transitionPreroll || 0)) : 0
	const transitionContentsDelay = transitionProps ? (transitionProps.transitionPreroll || 0) - (transitionProps.preroll || 0) : 0

	_.each(clone(pieces), (piece: Piece) => {
		if (piece.disabled) return
		if (piece.isTransition && (!allowTransition || isHold)) {
			return
		}

		if (piece.infiniteId && piece.infiniteId !== piece._id) {
			piece._id = piece.infiniteId
		}

		if (
			piece.content &&
			piece.content.timelineObjects
		) {
			let tos: TimelineObjectCoreExt[] = piece.content.timelineObjects

			const isInfiniteContinuation = piece.infiniteId && piece.infiniteId !== piece._id
			if (piece.enable.start === 0 && !isInfiniteContinuation) {
				// If timed absolute and there is a transition delay, then apply delay
				if (!piece.isTransition && allowTransition && transition && !piece.adLibSourceId) {
					const transitionContentsDelayStr = transitionContentsDelay < 0 ? `- ${-transitionContentsDelay}` : `+ ${transitionContentsDelay}`
					piece.enable.start = `#${getPieceGroupId(transition)}.start ${transitionContentsDelayStr}`
				} else if (piece.isTransition && transitionPieceDelay) {
					piece.enable.start = Math.max(0, transitionPieceDelay)
				}
			}

			// create a piece group for the pieces and then place all of them there
			const pieceGroup = createPieceGroup(piece, partGroup)
			timelineObjs.push(pieceGroup)

			if (!piece.virtual) {
				timelineObjs.push(createPieceGroupFirstObject(piece, pieceGroup, firstObjClasses))

				_.each(tos, (o: TimelineObjectCoreExt) => {
					fixTimelineId(o)
					if (o.holdMode) {
						if (isHold && !showHoldExcept && o.holdMode === TimelineObjHoldMode.EXCEPT) {
							return
						}
						if (!isHold && o.holdMode === TimelineObjHoldMode.ONLY) {
							return
						}
					}
					// if (partGroup) {
						// If we are leaving a HOLD, the transition was suppressed, so force it to run now
						// if (item.isTransition && holdState === RundownHoldState.COMPLETE) {
						// 	o.trigger.value = TriggerType.TIME_ABSOLUTE
						// 	o.trigger.value = 'now'
						// }
					// }

					timelineObjs.push({
						...o,
						_id: '', // set later
						studioId: '', // set later
						inGroup: partGroup ? pieceGroup.id : undefined,
						rundownId: rundown._id,
						objectType: TimelineObjType.RUNDOWN,
						pieceId: piece._id,
						infinitePieceId: piece.infiniteId
					})
				})
			}
		}
	})
	return timelineObjs
}

function calcPartKeepaliveDuration (fromPart: Part, toPart: Part, relativeToFrom: boolean): number {
	const allowTransition: boolean = !fromPart.disableOutTransition
	if (!allowTransition) {
		return fromPart.autoNextOverlap || 0
	}

	if (relativeToFrom) { // TODO remove
		if (toPart.transitionKeepaliveDuration === undefined || toPart.transitionKeepaliveDuration === null) {
			return (toPart.prerollDuration || 0)
		}

		const transPieceDelay = Math.max(0, (toPart.prerollDuration || 0) - (toPart.transitionPrerollDuration || 0))
		return transPieceDelay + (toPart.transitionKeepaliveDuration || 0)
	}

	// if (toPart.transitionKeepaliveDuration === undefined || toPart.transitionKeepaliveDuration === null) {
	// 	return (fromPart.autoNextOverlap || 0)
	// }

	return 0
}
function calcPartTargetDuration (prevPart: Part | undefined, currentPart: Part): number {
	if (currentPart.expectedDuration === undefined) {
		return 0
	}

	// This is a horrible hack, to compensate for the expectedDuration mangling in the blueprints which is
	// needed to get the show runtime to be correct. This just inverts that mangling before running as 'intended'
	const maxPreroll = Math.max(currentPart.transitionPrerollDuration ? currentPart.transitionPrerollDuration : 0, currentPart.prerollDuration || 0)
	const maxKeepalive = Math.max(currentPart.transitionKeepaliveDuration ? currentPart.transitionKeepaliveDuration : 0, currentPart.prerollDuration || 0)
	const lengthAdjustment = maxPreroll - maxKeepalive
	const rawExpectedDuration = (currentPart.expectedDuration || 0) - lengthAdjustment

	if (!prevPart || prevPart.disableOutTransition) {
		return rawExpectedDuration + (currentPart.prerollDuration || 0)
	}

	let prerollDuration = (currentPart.transitionPrerollDuration || currentPart.prerollDuration || 0)
	return rawExpectedDuration + (prevPart.autoNextOverlap || 0) + prerollDuration
}
function calcPartOverlapDuration (fromPart: Part, toPart: Part): number {
	const allowTransition: boolean = !fromPart.disableOutTransition
	let overlapDuration: number = toPart.prerollDuration || 0
	if (allowTransition && toPart.transitionPrerollDuration) {
		overlapDuration = calcPartKeepaliveDuration(fromPart, toPart, true)
	}

	if (fromPart.autoNext) {
		overlapDuration += (fromPart.autoNextOverlap || 0)
	}

	return overlapDuration
}
