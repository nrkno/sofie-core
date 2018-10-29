import * as _ from 'underscore'
import * as moment from 'moment'
import { SaferEval } from 'safer-eval'
import { iterateDeeply, iterateDeeplyEnum } from '../../lib/lib'
import {
	IMOSROFullStory, IMOSRunningOrder, IMOSStory
} from 'mos-connection'
import { SegmentLine, DBSegmentLine, SegmentLineNote, SegmentLineNoteType } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItemGeneric } from '../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItem } from '../../lib/collections/SegmentLineAdLibItems'
import { RunningOrderBaselineItem } from '../../lib/collections/RunningOrderBaselineItems'
import { formatDateAsTimecode, formatDurationAsTimecode } from '../../lib/lib'
import { getHash } from '../lib'
import { logger } from '../logging'
import { RunningOrder } from '../../lib/collections/RunningOrders'
import { TimelineObj } from '../../lib/collections/Timeline'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'
import { ShowStyle } from '../../lib/collections/ShowStyles'
import { Meteor } from 'meteor/meteor'
import { ShowBlueprints, ShowBlueprint } from '../../lib/collections/ShowBlueprints'

export enum LayerType {
	Source,
	Output,
	LLayer,
}
class CommonContext implements ICommonContext {
	runningOrderId: string
	runningOrder: RunningOrder
	segmentLine: SegmentLine | undefined

	iterateDeeply: (obj: any, iteratee: (val: any, key?: string | number) => (any | iterateDeeplyEnum), key?: string | number) => any

	private hashI = 0
	private hashed: {[hash: string]: string} = {}
	private savedNotes: Array<SegmentLineNote> = []

	private story: IMOSStory | undefined

	constructor (runningOrder: RunningOrder, segmentLine?: SegmentLine, story?: IMOSStory) {
		this.runningOrderId = runningOrder._id
		this.runningOrder = runningOrder
		this.segmentLine = segmentLine
		this.story = story

		this.iterateDeeply = iterateDeeply
	}

	getStudioInstallation (): StudioInstallation {
		const studio = StudioInstallations.findOne(this.runningOrder.studioInstallationId)
		if (!studio) throw new Meteor.Error(404, 'StudioInstallation "' + this.runningOrder.studioInstallationId + '" not found')

		return studio
	}
	getHashId (str?: any) {

		if (!str) str = 'hash' + (this.hashI++)

		let id
		id = getHash(
			this.runningOrderId + '_' +
			(this.segmentLine ? this.segmentLine._id + '_' : '') +
			str.toString()
		)
		this.hashed[id] = str
		return id
		// return Random.id()
	}
	unhashId (hash: string): string {
		return this.hashed[hash] || hash
	}
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
	}
	getConfig (): any {
		const studio: StudioInstallation = this.getStudioInstallation()
		return studio.config
	}

	getLoggerName () {
		if (this.story && this.story.Slug) {
			return this.story.Slug.toString()
		} else if (this.segmentLine) {
			return this.segmentLine.mosId
		} else {
			return ''
		}
	}
	error (message: string) {
		logger.error('Error from template: ' + message)

		const name = this.getLoggerName()

		this.savedNotes.push({
			type: SegmentLineNoteType.ERROR,
			origin: {
				name: name,
				roId: this.runningOrderId,
				segmentId: this.story || !this.segmentLine ? undefined : this.segmentLine.segmentId,
				segmentLineId: this.story && this.segmentLine ? this.segmentLine._id : undefined
				// segmentLineItemId?: string,
			},
			message: message
		})

		throw new Meteor.Error(500, message)
	}
	warning (message: string) {
		// logger.warn('Warning from template: ' + message)
		// @todo: save warnings, maybe to the RO somewhere?
		// it should be displayed to the user in the UI

		const name = this.getLoggerName()

		this.savedNotes.push({
			type: SegmentLineNoteType.WARNING,
			origin: {
				name: name,
				roId: this.runningOrderId,
				segmentId: this.story || !this.segmentLine ? undefined : this.segmentLine.segmentId,
				segmentLineId: this.story && this.segmentLine ? this.segmentLine._id : undefined
				// segmentLineItemId?: string,
			},
			message: message
		})
	}
	getNotes () {
		return this.savedNotes
	}
}

export function getRunStoryContext (runningOrder: RunningOrder, segmentLine: SegmentLine, story: IMOSROFullStory): RunStoryContext {
	class RunStoryContextImpl extends CommonContext implements RunStoryContext {
		segmentLine: SegmentLine

		getRuntimeArguments (): TemplateRuntimeArguments {
			return segmentLine.runtimeArguments || {}
		}

		getSegmentLines (): Array<SegmentLine> {
			// return stories in segmentLine
			const ro: RunningOrder = this.runningOrder
			return ro.getSegmentLines().filter((sl: SegmentLine) => sl.segmentId === this.segmentLine.segmentId)
		}
		getSegmentLineIndex (): number {
			return this.getSegmentLines().findIndex((sl: SegmentLine) => sl._id === this.segmentLine._id)
		}
	}

	return new RunStoryContextImpl(runningOrder, segmentLine, story)
}

export function getPostProcessContext (runningOrder: RunningOrder, segmentLine: SegmentLine): PostProcessContext {
	class PostProcessContextImpl extends CommonContext implements PostProcessContext {
		segmentLine: SegmentLine

		getSegmentLines (): Array<SegmentLine> {
			// return stories in segmentLine
			const ro: RunningOrder = this.runningOrder
			return ro.getSegmentLines().filter((sl: SegmentLine) => sl.segmentId === this.segmentLine.segmentId)
		}
	}

	return new PostProcessContextImpl(runningOrder, segmentLine)
}

export function getBaselineContext (runningOrder: RunningOrder): BaselineContext {
	class BaselineContextImpl extends CommonContext implements BaselineContext {
	}

	return new BaselineContextImpl(runningOrder)
}

export function getMessageContext (runningOrder: RunningOrder): MessageContext {
	class MessageContextImpl extends CommonContext implements MessageContext {
		getCachedStoryForRunningOrder (): IMOSRunningOrder {
			return this.runningOrder.fetchCache('roCreate' + this.runningOrder._id)
		}
		getCachedStoryForSegmentLine (segmentLine: SegmentLine): IMOSROFullStory {
			return this.runningOrder.fetchCache('fullStory' + segmentLine._id)
		}

		getAllSegmentLines (): Array<SegmentLine> {
			return this.runningOrder.getSegmentLines()
		}

		formatDateAsTimecode (time: Date | number): string {
			let date = (
				_.isDate(time) ?
				time :
				new Date(time)
			)
			return formatDateAsTimecode(date)
		}
		formatDurationAsTimecode (time: number): string {
			return formatDurationAsTimecode(time)
		}
	}

	return new MessageContextImpl(runningOrder)
}

const blueprintCache: {[id: string]: Cache} = {}
interface Cache {
	modified: number,
	fcn: BlueprintCollection
}

export interface BlueprintCollection {
	Baseline: (context: BaselineContext) => BaselineResult
	RunStory: (context: RunStoryContext, story: IMOSROFullStory) => StoryResult | null
	PostProcess: (context: PostProcessContext) => PostProcessResult
	Message: (context: MessageContext, runningOrder: RunningOrder, takeSegmentLine: SegmentLine, previousSegmentLine: SegmentLine) => any
	Version: string // TODO - pull into a db field at upload time (will also verify script parses), and show in the ui
}
export interface BaselineResult {
	adLibItems: SegmentLineAdLibItem[]
	baselineItems: RunningOrderBaselineItem[]
}
export interface StoryResult {
	SegmentLine: DBSegmentLine
	SegmentLineItems: SegmentLineItemGeneric[]
	AdLibItems: SegmentLineAdLibItem[]
}
export interface PostProcessResult {
	SegmentLineItems: SegmentLineItemGeneric[]
}

export interface ICommonContext {
	runningOrderId: string
	runningOrder: RunningOrder

	getHashId: (stringToBeHashed?: string | number) => string
	unhashId: (hash: string) => string
	getLayer: (type: LayerType, key: string) => string // TODO - remove
	getConfig: () => any
	iterateDeeply: (obj: any, iteratee: (val: any, key?: string | number) => (any | iterateDeeplyEnum), key?: string | number) => any
	error: (message: string) => void
	warning: (message: string) => void
	getNotes: () => Array<any>
}

export interface BaselineContext extends ICommonContext {
}

export interface TemplateRuntimeArguments {
	[key: string]: string
}

export interface RunStoryContext extends ICommonContext {
	segmentLine: DBSegmentLine

	getRuntimeArguments: () => TemplateRuntimeArguments

	// TODO - remove these getSegmentLine* as it could cause problems when moving a sl
	getSegmentLines: () => Array<DBSegmentLine>
	getSegmentLineIndex: () => number
}
export interface PostProcessContext extends ICommonContext {
	getSegmentLines: () => Array<DBSegmentLine>
}
export interface MessageContext extends ICommonContext {
	getCachedStoryForSegmentLine: (segmentLine: DBSegmentLine) => IMOSROFullStory
	getCachedStoryForRunningOrder: () => IMOSRunningOrder
	getAllSegmentLines: () => Array<DBSegmentLine>
	formatDateAsTimecode: (date: Date) => string
	formatDurationAsTimecode: (time: number) => string
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
			moment,
		}

		const entry = new SaferEval(context, { filename: showStyleName + '.js' }).runInContext(blueprintDoc.code)
		return entry.default
	}
}

export function postProcessSegmentLineItems (innerContext: ICommonContext, segmentLineItems: SegmentLineItemGeneric[], templateId: string, segmentLineId: string): SegmentLineItem[] {
	let i = 0
	let segmentLinesUniqueIds: { [id: string]: true } = {}
	return _.map(_.compact(segmentLineItems), (itemOrg: SegmentLineItemGeneric) => {
		let item: SegmentLineItem = itemOrg as SegmentLineItem

		if (!item._id) item._id = innerContext.getHashId('postprocess_sli_' + (i++))
		if (!item.runningOrderId) item.runningOrderId = innerContext.runningOrderId
		if (!item.segmentLineId) item.segmentLineId = segmentLineId
		if (!item.mosId && !item.isTransition) throw new Meteor.Error(400, 'Error in template "' + templateId + '": mosId not set for segmentLineItem in ' + segmentLineId + '! ("' + innerContext.unhashId(item._id) + '")')

		if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of segmentLineItems must be unique! ("' + innerContext.unhashId(item._id) + '")')
		segmentLinesUniqueIds[item._id] = true

		if (item.content && item.content.timelineObjects) {
			item.content.timelineObjects = _.compact(item.content.timelineObjects)

			let timelineUniqueIds: { [id: string]: true } = {}
			_.each(item.content.timelineObjects, (o: TimelineObj) => {

				if (!o._id) o._id = innerContext.getHashId('postprocess_' + (i++))

				if (timelineUniqueIds[o._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(o._id) + '")')
				timelineUniqueIds[o._id] = true
			})
		}

		return item
	})
}

export function postProcessSegmentLineAdLibItems (innerContext: ICommonContext, segmentLineAdLibItems: SegmentLineAdLibItem[], templateId: string, segmentLineId?: string): SegmentLineAdLibItem[] {
	let i = 0
	let segmentLinesUniqueIds: { [id: string]: true } = {}
	return _.map(_.compact(segmentLineAdLibItems), (item: SegmentLineAdLibItem) => {
		if (!item._id) item._id = innerContext.getHashId('postprocess_adlib_' + (i++))
		if (!item.runningOrderId) item.runningOrderId = innerContext.runningOrderId
		if (!item.segmentLineId && segmentLineId) item.segmentLineId = segmentLineId
		if (!item.mosId) throw new Meteor.Error(400, 'Error in template "' + templateId + '": mosId not set for segmentLineItem in ' + segmentLineId + '! ("' + innerContext.unhashId(item._id) + '")')

		if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of segmentLineItems must be unique! ("' + innerContext.unhashId(item._id) + '")')
		segmentLinesUniqueIds[item._id] = true

		if (item.content && item.content.timelineObjects) {
			item.content.timelineObjects = _.compact(item.content.timelineObjects)

			let timelineUniqueIds: { [id: string]: true } = {}
			_.each(item.content.timelineObjects, (o: TimelineObj) => {

				if (!o._id) o._id = innerContext.getHashId('postprocess_' + (i++))

				if (timelineUniqueIds[o._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(o._id) + '")')
				timelineUniqueIds[o._id] = true
			})
		}

		return item
	})
}

export function postProcessSegmentLineBaselineItems (innerContext: BaselineContext, baselineItems: RunningOrderBaselineItem[], templateId: string): RunningOrderBaselineItem[] {
	let i = 0
	let segmentLinesUniqueIds: { [id: string]: true } = {}
	return _.map(_.compact(baselineItems), (item: RunningOrderBaselineItem) => {
		if (!item._id) item._id = innerContext.getHashId('postprocess_baseline_' + (i++))
		if (!item.runningOrderId) item.runningOrderId = innerContext.runningOrderId
		item.segmentLineId = undefined

		if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of segmentLineItems must be unique! ("' + innerContext.unhashId(item._id) + '")')
		segmentLinesUniqueIds[item._id] = true

		if (item.content && item.content.timelineObjects) {
			item.content.timelineObjects = _.compact(item.content.timelineObjects)

			let timelineUniqueIds: { [id: string]: true } = {}
			_.each(item.content.timelineObjects, (o: TimelineObj) => {

				if (!o._id) o._id = innerContext.getHashId('postprocess_' + (i++))

				if (timelineUniqueIds[o._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(o._id) + '")')
				timelineUniqueIds[o._id] = true
			})
		}

		return item
	})
}
