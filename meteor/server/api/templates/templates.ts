import * as _ from 'underscore'
import { SaferEval } from 'safer-eval'
import * as objectPath from 'object-path'
import { iterateDeeply, iterateDeeplyEnum } from '../../../lib/lib'
import {
	IMOSROFullStory, IMOSRunningOrder, IMOSStory
} from 'mos-connection'
import { SegmentLine, DBSegmentLine, SegmentLineNote, SegmentLineNoteType } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem } from '../../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItem } from '../../../lib/collections/SegmentLineAdLibItems'
import { RunningOrderBaselineItem } from '../../../lib/collections/RunningOrderBaselineItems'
import { literal, Optional, formatDateAsTimecode, Time, formatDurationAsTimecode } from '../../../lib/lib'
import { getHash } from '../../lib'
import { logger } from '../../logging'
import { RunningOrders, RunningOrder } from '../../../lib/collections/RunningOrders'
import { TimelineObj } from '../../../lib/collections/Timeline'
import { StudioInstallations, StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { ShowStyle } from '../../../lib/collections/ShowStyles'
import { Meteor } from 'meteor/meteor'
import { ShowBlueprints, ShowBlueprint } from '../../../lib/collections/ShowBlueprints'

export type SegmentLineItemOptional = Optional<SegmentLineItem>
export type SegmentLineAdLibItemOptional = Optional<SegmentLineAdLibItem>
export type RunningOrderBaselineItemOptional = Optional<RunningOrderBaselineItem>

export interface TemplateRuntimeArguments {
	[key: string]: string
}

export interface TemplateContext {
	noCache: boolean
	runningOrderId: string
	runningOrder: RunningOrder
	studioId: string
	// segment: Segment
	segmentLine: SegmentLine
	templateId: string
	runtimeArguments: TemplateRuntimeArguments
}

export enum LayerType {
	Source,
	Output,
	LLayer,
}
export interface TemplateContextInnerBase {
	getHashId: (str?: any) => string
	unhashId: (hash: string) => string
	getLayer: (type: LayerType, key: string) => string
	getConfig: () => any
	getValueByPath: (obj: object | undefined, path: string, defaultValue?: any) => any
	setValueByPath: (obj: object | undefined, path: string, value: any) => void
	iterateDeeply: (obj: any, iteratee: (val: any, key?: string | number) => (any | iterateDeeplyEnum), key?: string | number) => any
	error: (message: string) => void
	warning: (message: string) => void
	getSegmentLines: () => Array<SegmentLine>
	getSegmentLineIndex: () => number
	formatDateAsTimecode: (date: Date) => string
	formatDurationAsTimecode: (time: number) => string
	getNotes: () => Array<SegmentLineNote>
	parseDateTime: (dateTime: string) => Time | null
	// extended:
	getAllSegmentLines: () => Array<SegmentLine>
}

export interface TemplateContextInner extends TemplateContext, TemplateContextInnerBase {
}
export interface TemplateContextInternalBase extends TemplateContextInnerBase {
	getRunningOrder: () => RunningOrder
	getShowStyleId: () => string
	getStudioInstallation: () => StudioInstallation
	getCachedStoryForSegmentLine: (segmentLine: SegmentLine) => IMOSROFullStory
	getCachedStoryForRunningOrder: () => IMOSRunningOrder
}
export interface TemplateContextInternal extends TemplateContextInner, TemplateContextInternalBase {
}

export function getContext (context: TemplateContext, extended?: boolean, story?: IMOSROFullStory): TemplateContextInternal {
	let hashI = 0
	let hashed: {[hash: string]: string} = {}
	let savedNotes: Array<SegmentLineNote> = []
	let c0 = literal<TemplateContextInternalBase>({
		getRunningOrder (): RunningOrder {
			const ro = RunningOrders.findOne(context.runningOrderId)
			if (!ro) throw new Meteor.Error(404, 'RunningOrder "' + context.runningOrderId + '" not found')
			return ro
		},
		getShowStyleId (): string {
			const ro: RunningOrder = this.getRunningOrder()
			return ro.showStyleId
		},
		getStudioInstallation (): StudioInstallation {
			const ro: RunningOrder = this.getRunningOrder()

			const studio = StudioInstallations.findOne(ro.studioInstallationId)
			if (!studio) throw new Meteor.Error(404, 'StudioInstallation "' + ro.studioInstallationId + '" not found')

			return studio
		},
		getHashId (str?: any) {

			if (!str) str = 'hash' + (hashI++)

			let id
			id = getHash(
				context.runningOrderId + '_' +
				(context.segmentLine ? context.segmentLine._id + '_' : '') +
				str.toString()
			)
			hashed[id] = str
			return id
			// return Random.id()
		},
		unhashId (hash: string): string {
			return hashed[hash] || hash
		},
		getLayer (type: LayerType, name: string): string {
			const studio: StudioInstallation = this.getStudioInstallation()

			let layer: any
			switch (type) {
				case LayerType.Output:
					layer = studio.outputLayers.find(l => l._id === name)
					break
				case LayerType.Source:
					layer = studio.sourceLayers.find(l => l._id === name)
					break
				case LayerType.LLayer:
					layer = _.find(studio.mappings, (v, k) => k === name)
					break
				default:
					throw new Meteor.Error(404, 'getLayer: LayerType "' + type + '" unknown')
			}

			if (layer) {
				return name
			}

			throw new Meteor.Error(404, 'Missing layer "' + name + '" of type LayerType."' + type + '"')
		},
		getConfig (): any {
			const studio: StudioInstallation = this.getStudioInstallation()
			return studio.config
		},
		getValueByPath (obj: object | undefined, path: string, defaultValue?: any): any {
			let value = (
				_.isUndefined(obj) ?
				undefined :
				objectPath.get(obj, path)
			)
			if (_.isUndefined(value) && !_.isUndefined(defaultValue)) value = defaultValue
			return value
		},
		setValueByPath (obj: object | undefined, path: string, value: any) {
			if (!_.isUndefined(obj)) objectPath.set(obj, path, value)
		},
		iterateDeeply,
		getSegmentLines (): Array<SegmentLine> {
			// return stories in segmentLine
			const ro: RunningOrder = this.getRunningOrder()
			return ro.getSegmentLines().filter((sl: SegmentLine) => sl.segmentId === context.segmentLine.segmentId)
		},
		getSegmentLineIndex (): number {
			return this.getSegmentLines().findIndex((sl: SegmentLine) => sl._id === context.segmentLine._id)
		},
		getCachedStoryForRunningOrder (): IMOSRunningOrder {
			let ro = this.getRunningOrder()
			return ro.fetchCache('roCreate' + ro._id)
		},
		getCachedStoryForSegmentLine (segmentLine: SegmentLine): IMOSROFullStory {
			let ro = this.getRunningOrder()
			return ro.fetchCache('fullStory' + segmentLine._id)
		},
		error (message: string) {
			logger.error('Error from template: ' + message)

			let name = context.segmentLine.mosId
			if (story && story.Slug) {
				name = story.Slug.toString()
			} else if (!story) {
				name = ''
			}

			savedNotes.push({
				type: SegmentLineNoteType.ERROR,
				origin: {
					name: name,
					roId: context.runningOrderId,
					segmentId: story ? undefined : context.segmentLine.segmentId,
					segmentLineId: story ? context.segmentLine._id : undefined
					// segmentLineItemId?: string,
				},
				message: message
			})

			throw new Meteor.Error(500, message)
		},
		warning (message: string) {
			// logger.warn('Warning from template: ' + message)
			// @todo: save warnings, maybe to the RO somewhere?
			// it should be displayed to the user in the UI

			let name = context.segmentLine.mosId
			if (story && story.Slug) {
				name = story.Slug.toString()
			} else if (!story) {
				name = ''
			}

			savedNotes.push({
				type: SegmentLineNoteType.WARNING,
				origin: {
					name: name,
					roId: context.runningOrderId,
					segmentId: story ? undefined : context.segmentLine.segmentId,
					segmentLineId: story ? context.segmentLine._id : undefined
					// segmentLineItemId?: string,
				},
				message: message
			})
		},
		formatDateAsTimecode (time: Date | number): string {
			let date = (
				_.isDate(time) ?
				time :
				new Date(time)
			)
			return formatDateAsTimecode(date)
		},
		formatDurationAsTimecode (time: number): string {
			return formatDurationAsTimecode(time)
		},
		getNotes () {
			return savedNotes
		},
		parseDateTime (dateTime: string): Time | null {
			const dtMatch = dateTime.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z|(\+|\-)(\d{2}):(\d{2}))?$/i)
			if (dtMatch) {
				const year = parseInt(dtMatch[1], 10)
				const month = parseInt(dtMatch[2], 10)
				const day = parseInt(dtMatch[3], 10)
				let hours = parseInt(dtMatch[4], 10)
				let minutes = parseInt(dtMatch[5], 10)
				const seconds = parseInt(dtMatch[6], 10)
				const tz = dtMatch[7]
				const tzSign = dtMatch[8]
				const tzHours = parseInt(dtMatch[9], 10)
				const tzMinutes = parseInt(dtMatch[10], 10)

				if (tz && tz !== 'Z') {
					const sign = tzSign === '+' ? -1 : 1
					hours = hours + (sign * tzHours)
					minutes = minutes + (sign * tzMinutes)
				}

				const time = new Date()
				time.setUTCFullYear(year, month - 1, day)
				time.setUTCHours(hours)
				time.setUTCMinutes(minutes)
				time.setUTCSeconds(seconds)

				return time.getTime()
			}
			return null
		},

		// ------------------
		// extended functions, only allowed by "special" functions, such as externalMessage
		getAllSegmentLines (): Array<SegmentLine> {
			if (!extended) throw Error('getAllSegmentLines: not allowed to use this function')

			const ro: RunningOrder = this.getRunningOrder()
			return ro.getSegmentLines()
		},
	})
	return _.extend(c0, context)
}
export interface TemplateResult {
	// segment: Segment,
	segmentLine: DBSegmentLine | null,
	segmentLineItems: Array<SegmentLineItemOptional> | null
	segmentLineAdLibItems: Array<SegmentLineAdLibItemOptional> | null
	baselineItems?: Array<RunningOrderBaselineItemOptional> | null
}
export interface TemplateResultAfterPost {
	// segment: Segment,
	notes: Array<SegmentLineNote>,
	segmentLine: DBSegmentLine | null,
	segmentLineItems: Array<SegmentLineItem> | null
	segmentLineAdLibItems: Array<SegmentLineAdLibItem> | null
	baselineItems: Array<RunningOrderBaselineItem> | null
}

const blueprintCache: {[id: string]: Cache} = {}
interface Cache {
	modified: number,
	fcn: BlueprintCollection
}

export interface BlueprintCollection {
	// TODO - change return types.
	// TODO - change context types
	Baseline: (context: TemplateContext) => any
	RunStory: (context: TemplateContext, story: IMOSStory) => TemplateResult
	PostProcess: (context: TemplateContext) => TemplateResult
	Message: (context: TemplateContext, runningOrder: RunningOrder, takeSegmentLine: SegmentLine, previousSegmentLine: SegmentLine) => any
}
export function loadBlueprints (showStyle: ShowStyle): BlueprintCollection {
	let blueprintDoc = ShowBlueprints.findOne({
		showStyleId: showStyle._id
	})

	if (blueprintDoc && blueprintDoc.code) {
		try {
			return evalBlueprints(blueprintDoc, showStyle.name, false)
		} catch (e) {
			throw new Meteor.Error(402, 'Syntax error in runtime function "' + showStyle.name + '": ' + e.toString())
		}
	}

	throw new Meteor.Error(404, 'Function for ShowStyle "' + showStyle.name + '" not found!')
}
function evalBlueprints (blueprintDoc: ShowBlueprint, showStyleName: string, noCache: boolean): BlueprintCollection {
	let cached: Cache | null = null
	if (!noCache) {
		// First, check if we've got the function cached:
		cached = blueprintCache[blueprintDoc._id] ? blueprintCache[blueprintDoc._id] : null
		if (cached && (!cached.modified || cached.modified !== blueprintDoc.modified)) {
			// the function has been updated, invalidate it then:
			cached = null
		}
	}

	if (cached) {
		return cached.fcn
	} else {
		const context = {
			_,
		}

		const entry = new SaferEval(context, { filename: showStyleName + '.js' }).runInContext(blueprintDoc.code)
		return entry.default
	}
}

export function postProcessResult (innerContext: TemplateContextInner, result: TemplateResult, templateId: string): TemplateResultAfterPost {
	let i = 0
	let segmentLinesUniqueIds: { [id: string]: true } = {}
	let resultAfterPost: TemplateResultAfterPost = {
		notes: innerContext.getNotes(),
		segmentLine: result.segmentLine,
		segmentLineItems: _.map(_.compact(result.segmentLineItems), (itemOrg: SegmentLineItemOptional) => {
			let item: SegmentLineItem = itemOrg as SegmentLineItem

			if (!item._id) item._id = innerContext.getHashId('postprocess_' + templateId + '_' + (i++))
			if (!item.runningOrderId) item.runningOrderId = innerContext.runningOrderId
			if (!item.segmentLineId) item.segmentLineId = innerContext.segmentLine._id
			if (!item.mosId && !item.isTransition) throw new Meteor.Error(400, 'Error in template "' + templateId + '": mosId not set for segmentLineItem in ' + innerContext.segmentLine._id + '! ("' + innerContext.unhashId(item._id) + '")')

			if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of segmentLineItems must be unique! ("' + innerContext.unhashId(item._id) + '")')
			segmentLinesUniqueIds[item._id] = true

			if (item.content && item.content.timelineObjects) {
				item.content.timelineObjects = _.compact(item.content.timelineObjects)

				let timelineUniqueIds: { [id: string]: true } = {}
				_.each(item.content.timelineObjects, (o: TimelineObj) => {

					if (!o._id) o._id = innerContext.getHashId('postprocess_' + templateId + '_' + (i++))

					if (timelineUniqueIds[o._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(o._id) + '")')
					timelineUniqueIds[o._id] = true
				})
			}

			return item
		}),
		segmentLineAdLibItems: result.segmentLineAdLibItems ? _.map(_.compact(result.segmentLineAdLibItems), (itemOrg: SegmentLineAdLibItemOptional) => {
			let item: SegmentLineAdLibItem = itemOrg as SegmentLineAdLibItem

			if (!item._id) item._id = innerContext.getHashId('postprocess_' + templateId + '_' + (i++))
			if (!item.runningOrderId) item.runningOrderId = innerContext.runningOrderId
			if (!item.segmentLineId) item.segmentLineId = innerContext.segmentLine._id
			if (!item.mosId) throw new Meteor.Error(400, 'Error in template "' + templateId + '": mosId not set for segmentLineItem in ' + innerContext.segmentLine._id + '! ("' + innerContext.unhashId(item._id) + '")')

			if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of segmentLineItems must be unique! ("' + innerContext.unhashId(item._id) + '")')
			segmentLinesUniqueIds[item._id] = true

			if (item.content && item.content.timelineObjects) {
				item.content.timelineObjects = _.compact(item.content.timelineObjects)

				let timelineUniqueIds: { [id: string]: true } = {}
				_.each(item.content.timelineObjects, (o: TimelineObj) => {

					if (!o._id) o._id = innerContext.getHashId('postprocess_' + templateId + '_' + (i++))

					if (timelineUniqueIds[o._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(o._id) + '")')
					timelineUniqueIds[o._id] = true
				})
			}

			return item
		}) : null,
		baselineItems: result.baselineItems ? _.map(_.compact(result.baselineItems), (itemOrg: RunningOrderBaselineItemOptional) => {
			let item: RunningOrderBaselineItem = itemOrg as RunningOrderBaselineItem

			if (!item._id) item._id = innerContext.getHashId('postprocess_' + templateId + '_' + (i++))
			if (!item.runningOrderId) item.runningOrderId = innerContext.runningOrderId
			item.segmentLineId = undefined

			if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of segmentLineItems must be unique! ("' + innerContext.unhashId(item._id) + '")')
			segmentLinesUniqueIds[item._id] = true

			if (item.content && item.content.timelineObjects) {
				item.content.timelineObjects = _.compact(item.content.timelineObjects)

				let timelineUniqueIds: { [id: string]: true } = {}
				_.each(item.content.timelineObjects, (o: TimelineObj) => {

					if (!o._id) o._id = innerContext.getHashId('postprocess_' + templateId + '_' + (i++))

					if (timelineUniqueIds[o._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(o._id) + '")')
					timelineUniqueIds[o._id] = true
				})
			}

			return item
		}) : null
	}
	return resultAfterPost
}
