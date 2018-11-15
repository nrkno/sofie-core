import * as _ from 'underscore'
import * as moment from 'moment'
import { SaferEval } from 'safer-eval'
import {
	IMOSROFullStory, IMOSRunningOrder, IMOSStory
} from 'mos-connection'
import { SegmentLine, DBSegmentLine, SegmentLineNote, SegmentLineNoteType } from '../../lib/collections/SegmentLines'
import { SegmentLineItem } from '../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItem } from '../../lib/collections/SegmentLineAdLibItems'
import { formatDateAsTimecode, formatDurationAsTimecode, literal } from '../../lib/lib'
import { getHash } from '../lib'
import { logger } from '../logging'
import { RunningOrder } from '../../lib/collections/RunningOrders'
import { TimelineObj } from '../../lib/collections/Timeline'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'
import { ShowStyle } from '../../lib/collections/ShowStyles'
import { Meteor } from 'meteor/meteor'
import { ShowBlueprints, ShowBlueprint } from '../../lib/collections/ShowBlueprints'
import {
	BlueprintCollection,
	ICommonContext,
	RunStoryContext,
	BaselineContext,
	PostProcessContext,
	MessageContext,
	LayerType
} from 'tv-automation-sofie-blueprints-integration/dist/api'
import { IBlueprintSegmentLineItem, IBlueprintSegmentLineAdLibItem, BlueprintRuntimeArguments, IBlueprintSegmentLine } from 'tv-automation-sofie-blueprints-integration/dist/runningOrder'
import { RunningOrderAPI } from '../../lib/api/runningOrder'
import { TimelineObjectCoreExt } from 'tv-automation-sofie-blueprints-integration/dist/timeline';

class CommonContext implements ICommonContext {
	runningOrderId: string
	runningOrder: RunningOrder
	segmentLine: SegmentLine | undefined

	private hashI = 0
	private hashed: {[hash: string]: string} = {}
	private savedNotes: Array<SegmentLineNote> = []

	private story: IMOSStory | undefined

	constructor (runningOrder: RunningOrder, segmentLine?: SegmentLine, story?: IMOSStory) {
		this.runningOrderId = runningOrder._id
		this.runningOrder = runningOrder
		this.segmentLine = segmentLine
		this.story = story
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
	getConfig (): {[key: string]: string} {
		const studio: StudioInstallation = this.getStudioInstallation()

		const res: {[key: string]: string} = {}
		for (let c of studio.config) {
			res[c._id] = c.value
		}

		return res
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

		getRuntimeArguments (): BlueprintRuntimeArguments {
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
		getCachedStoryForSegmentLine (segmentLine: IBlueprintSegmentLine): IMOSROFullStory {
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
export function evalBlueprints (blueprintDoc: ShowBlueprint, showStyleName: string, noCache: boolean): BlueprintCollection {
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

export function postProcessSegmentLineItems (innerContext: ICommonContext, segmentLineItems: IBlueprintSegmentLineItem[], templateId: string, segmentLineId: string): SegmentLineItem[] {
	let i = 0
	let segmentLinesUniqueIds: { [id: string]: true } = {}
	return _.map(_.compact(segmentLineItems), (itemOrig: IBlueprintSegmentLineItem) => {
		let item: SegmentLineItem = {
			runningOrderId: innerContext.runningOrder._id,
			segmentLineId: itemOrig.segmentLineId || segmentLineId,
			status: RunningOrderAPI.LineItemStatusCode.UNKNOWN,
			...itemOrig
		}

		if (!item._id) item._id = innerContext.getHashId(templateId + '_sli_' + (i++))
		if (!item.mosId && !item.isTransition) throw new Meteor.Error(400, 'Error in template "' + templateId + '": mosId not set for segmentLineItem in ' + segmentLineId + '! ("' + innerContext.unhashId(item._id) + '")')

		if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of segmentLineItems must be unique! ("' + innerContext.unhashId(item._id) + '")')
		segmentLinesUniqueIds[item._id] = true

		if (item.content && item.content.timelineObjects) {
			let timelineUniqueIds: { [id: string]: true } = {}
			item.content.timelineObjects = _.map(_.compact(item.content.timelineObjects), (o: TimelineObjectCoreExt) => {
				const item = convertTimelineObject(o)

				if (!item._id) item._id = innerContext.getHashId(templateId + '_' + (i++))

				if (timelineUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(item._id) + '")')
				timelineUniqueIds[item._id] = true

				return item
			})
		}

		return item
	})
}

export function postProcessSegmentLineAdLibItems (innerContext: ICommonContext, segmentLineAdLibItems: IBlueprintSegmentLineAdLibItem[], templateId: string, segmentLineId?: string): SegmentLineAdLibItem[] {
	let i = 0
	let segmentLinesUniqueIds: { [id: string]: true } = {}
	return _.map(_.compact(segmentLineAdLibItems), (itemOrig: IBlueprintSegmentLineAdLibItem) => {
		let item: SegmentLineAdLibItem = {
			_id: innerContext.getHashId(templateId + '_adlib_sli_' + (i++)),
			runningOrderId: innerContext.runningOrder._id,
			segmentLineId: segmentLineId,
			status: RunningOrderAPI.LineItemStatusCode.UNKNOWN,
			trigger: undefined,
			disabled: false,
			...itemOrig
		}

		if (!item.mosId) throw new Meteor.Error(400, 'Error in template "' + templateId + '": mosId not set for segmentLineItem in ' + segmentLineId + '! ("' + innerContext.unhashId(item._id) + '")')

		if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in blueprint "' + templateId + '": ids of segmentLineItems must be unique! ("' + innerContext.unhashId(item._id) + '")')
		segmentLinesUniqueIds[item._id] = true

		if (item.content && item.content.timelineObjects) {
			let timelineUniqueIds: { [id: string]: true } = {}
			item.content.timelineObjects = _.map(_.compact(item.content.timelineObjects), (o: TimelineObjectCoreExt) => {
				const item = convertTimelineObject(o)

				if (!item._id) item._id = innerContext.getHashId(templateId + '_adlib_' + (i++))

				if (timelineUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in blueprint "' + templateId + '": ids of timelineObjs must be unique! ("' + innerContext.unhashId(item._id) + '")')
				timelineUniqueIds[item._id] = true

				return item
			})
		}

		return item
	})
}

function convertTimelineObject (o: TimelineObjectCoreExt): TimelineObj {
	let item: TimelineObj = {
		_id: o.id,
		siId: '',
		roId: '',
		deviceId: [''],
		...o,
		id: '' // To makes types match
	}
	delete item['id']

	return item
}

export function postProcessSegmentLineBaselineItems (innerContext: BaselineContext, baselineItems: TimelineObj[]): TimelineObj[] {
	let i = 0
	let timelineUniqueIds: { [id: string]: true } = {}
	return _.map(_.compact(baselineItems), (o: TimelineObjectCoreExt) => {
		const item = convertTimelineObject(o)

		if (!item._id) item._id = innerContext.getHashId('baseline_' + (i++))

		if (timelineUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in baseline blueprint: ids of timelineObjs must be unique! ("' + innerContext.unhashId(item._id) + '")')
		timelineUniqueIds[item._id] = true
		return item
	})
}
