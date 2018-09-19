import * as _ from 'underscore'
import { SaferEval } from 'safer-eval'
import * as objectPath from 'object-path'
import * as moment from 'moment'
import { Random } from 'meteor/random'
import { iterateDeeply, iterateDeeplyEnum } from '../../../lib/lib'
import {
	IMOSROFullStory, IMOSRunningOrder,
} from 'mos-connection'
import { RuntimeFunctions, RuntimeFunction } from '../../../lib/collections/RuntimeFunctions'
import { SegmentLine, DBSegmentLine, SegmentLineHoldMode, SegmentLineNote, SegmentLineNoteType } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItemLifespan } from '../../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItem } from '../../../lib/collections/SegmentLineAdLibItems'
import { RunningOrderBaselineItem } from '../../../lib/collections/RunningOrderBaselineItems'
import { literal, Optional, getCurrentTime, formatDateAsTimecode, Time, formatDurationAsTimecode } from '../../../lib/lib'
import * as crypto from 'crypto'
import { getHash } from '../../lib'
import {
	TimelineContentTypeCasparCg,
	TimelineContentTypeLawo,
	TimelineContentTypeAtem,
	TimelineContentTypeHttp,
	TimelineContentTypeOther,
	Atem_Enums,
	EmberPlusValueType,
	TimelineObjHoldMode,
} from '../../../lib/collections/Timeline'
import { TriggerType } from 'superfly-timeline'
import { RundownAPI } from '../../../lib/api/rundown'
import { PlayoutTimelinePrefixes } from '../../../lib/api/playout'
import { Transition, Ease, Direction } from '../../../lib/constants/casparcg'
import { logger } from '../../logging'
import { RunningOrders, RunningOrder } from '../../../lib/collections/RunningOrders'
import { TimelineObj } from '../../../lib/collections/Timeline'
import { StudioInstallations, StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { ShowStyle } from '../../../lib/collections/ShowStyles'
import { RuntimeFunctionDebugData } from '../../../lib/collections/RuntimeFunctionDebugData'

export type TemplateGeneralFunction = (story: IMOSROFullStory | null) => TemplateResult | string
export type TemplateFunctionOptional = (context: TemplateContextInner, story: StoryWithContext) => TemplateResult | string

/*
// Note: This syntax requires Typescript 2.8, and we're on 2.5 for the time being..
type Fix<T> = {
	[K in keyof T]: K extends '_id' ? T[K] | undefined :
		K extends 'segmentLineId' ? T[K] | undefined :
		K extends 'runningOrderId' ? T[K] | undefined :
	T[K]
}
export type SegmentLineItemOptional = Fix<SegmentLineItem>
*/
// type Optional<T> = {
// 	[K in keyof T]?: T[K]
// }

// type Test<T> = {
// 	[K in keyof T]: T[K]
// }

// export interface SegmentLineItemOptional extends Optional<SegmentLineItem> {
// 	content?: {
// 		[key: string]: Array<SomeTimelineObject> | number | string | boolean | object | undefined | null
// 		timelineObjects?: Array<SomeTimelineObject | null>
// 	}
// }
export type SegmentLineItemOptional = Optional<SegmentLineItem>
export type SegmentLineAdLibItemOptional = Optional<SegmentLineAdLibItem>
export type RunningOrderBaselineItemOptional = Optional<RunningOrderBaselineItem>

export interface TemplateSet {
	getId: (context: TemplateContextInner, story: IMOSROFullStory) => string
	templates: {
		[key: string]: TemplateFunctionOptional
	}
}
export interface TemplateContext {
	runningOrderId: string
	studioId: string
	// segment: Segment
	segmentLine: SegmentLine
	templateId: string
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
	getConfigValue: (key: string, defaultValue?: any) => any
	getValueByPath: (obj: object | undefined, path: string, defaultValue?: any) => any
	iterateDeeply: (obj: any, iteratee: (val: any, key?: string | number) => (any | iterateDeeplyEnum), key?: string | number) => any
	getHelper: (functionId: string) => Function
	runHelper: (functionId: string, ...args: any[]) => any
	error: (message: string) => void
	warning: (message: string) => void
	getSegmentLines: () => Array<SegmentLine>
	getSegmentLineIndex: () => number
	formatDateAsTimecode: (date: Date) => string
	formatDurationAsTimecode: (time: number) => string
	getNotes: () => Array<SegmentLineNote>
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
		getConfigValue (key: string, defaultValue?: any): any {
			const studio: StudioInstallation = this.getStudioInstallation()

			const value = studio.getConfigValue(key)
			if (value === null) return defaultValue

			if (defaultValue && typeof defaultValue === 'number') {
				return parseFloat(value)
			}

			return value
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
		iterateDeeply,
		getHelper (functionId: string): Function {
			const func = RuntimeFunctions.findOne({
				showStyleId: this.getShowStyleId(),
				active: true,
				templateId: functionId,
				isHelper: true
			})
			if (!func) throw new Meteor.Error(404, 'RuntimeFunctions helper "' + functionId + '" not found')

			try {
				return convertCodeToGeneralFunction(func, 'getHelper')
			} catch (e) {
				throw new Meteor.Error(402, 'Syntax error in runtime function helper "' + functionId + '": ' + e.toString())
			}
		},
		runHelper (functionId: string, ...args: any[]): any {
			return this.getHelper(functionId)(...args)
		},
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

function injectContextIntoArguments (context: TemplateContextInner, args: any[]): Array<any> {
	_.each(args, (arg: StoryWithContext) => {
		if (_.isObject(arg)) {
			// inject functions
			let c0 = literal<StoryWithContextBase>({
				getValueByPath (path: string, defaultValue?: any) {
					return context.getValueByPath(arg, path, defaultValue)
				}
			})
			_.extend(arg, c0)
		}
	})
	return args
}
export interface StoryWithContextBase {
	getValueByPath: (path: string, defaultValue?: any) => any
}
export interface StoryWithContext extends IMOSROFullStory, StoryWithContextBase {
}

export function convertCodeToGeneralFunction (runtimeFunction: RuntimeFunction, reason: string): TemplateGeneralFunction {
	// Just use the function () { .* } parts (omit whatevers before or after)
	// let functionStr = ((runtimeFunction.code + '').match(/function[\s\S]*}/) || [])[0]
	let m = ((runtimeFunction.code + '').match(/([\s\S]*?)(function[\s\S]*})/) || [])
	let preFunctionStr = (m[1] || '')
	let functionStr = m[2]

	// logger.debug('functionStr', functionStr)
	if (!functionStr) throw Error('Function empty!')
	if (preFunctionStr) { // Insert some blank lines, so that the line numbers add up
		let lineCount = (preFunctionStr.match(/\n/g) || []).length
		preFunctionStr = ''
		for (let i = 0; i < lineCount; i++) {
			preFunctionStr += '\r\n'
		}
		let a = functionStr.indexOf('\n')
		if (a) {
			functionStr = functionStr.slice(0, a + 1) + preFunctionStr + functionStr.slice(a + 1)
		}
	}
	let context = {
		_,
		moment,
		LayerType,
		TriggerType,
		TimelineContentTypeOther,
		TimelineContentTypeCasparCg,
		TimelineContentTypeLawo,
		TimelineContentTypeAtem,
		TimelineContentTypeHttp,
		Atem_Enums,
		LineItemStatusCode: RundownAPI.LineItemStatusCode,
		EmberPlusValueType,
		Transition,
		Ease,
		Direction,
		SegmentLineItemLifespan,
		PlayoutTimelinePrefixes,
		SegmentLineHoldMode,
		TimelineObjHoldMode,
	}

	let runtimeFcn: TemplateGeneralFunction = new SaferEval(context, { filename: runtimeFunction.templateId + '.js' }).runInContext(functionStr)
	return (...args) => {
		saveDebugData(runtimeFunction, reason, ...args)
		// @ts-ignore the function can be whatever, really
		return runtimeFcn(...args)
	}
}
export function convertCodeToFunction (context: TemplateContextInner, runtimeFunction: RuntimeFunction, reason: string): TemplateGeneralFunction {
	let runtimeFcn = convertCodeToGeneralFunction(runtimeFunction, reason)
	// logger.debug('runtimeFcn', runtimeFcn)
	let fcn = (...args: any[]) => {
		let result = runtimeFcn.apply(context, [context].concat(injectContextIntoArguments(context, args)))
		return result
	}
	return fcn
}
let lastTimeout: number | null = null
function saveDebugData (runtimeFunction: RuntimeFunction, reason: string, ...args) {
	// console.log('saveDebugData queue', reason)
	// Do this later, because this is low-prio:
	lastTimeout = Meteor.setTimeout(() => {
		// console.log('saveDebugData', reason)
		// Save a copy of the data, for debugging in the editor:
		let code = runtimeFunction.code

		let hash = getHash(args.join(','))

		let rfdd = RuntimeFunctionDebugData.findOne({
			showStyleId: runtimeFunction.showStyleId,
			templateId: runtimeFunction.templateId,
			reason: reason,
			dataHash: hash
		}, {fields: {data: 0}})
		if (rfdd) {
			// console.log('updating ' + rfdd._id)
			RuntimeFunctionDebugData.update(rfdd._id, {$set: {
				created: getCurrentTime()
			}})
		} else {
			let id = RuntimeFunctionDebugData.insert({
				_id: Random.id(),
				showStyleId: runtimeFunction.showStyleId,
				templateId: runtimeFunction.templateId,
				reason: reason,
				dataHash: hash,
				created: getCurrentTime(),
				data: args
			})
			// console.log('inserting ' + id)
		}

		// remove oldest if we have more than 3 versions:
		let rfdds = RuntimeFunctionDebugData.find({
			showStyleId: runtimeFunction.showStyleId,
			templateId: runtimeFunction.templateId,
		}, {
			fields: {data: 0},
			sort: {created: -1}
		}).fetch()
		if (rfdds.length > 3) {
			_.each(rfdds.slice(3), (rfdd) => {
				if (!rfdd.dontRemove) {
					// console.log('removing ' + rfdd._id)
					RuntimeFunctionDebugData.remove(rfdd._id)
				}
			})
		}
	}, 100)
}
export function preventSaveDebugData () {
	// called by the client code to prevent the last saving of data
	if (lastTimeout) {
		// console.log('prevent SaveDebugData')
		Meteor.clearTimeout(lastTimeout)
		lastTimeout = null
	}
}
function findFunction (showStyle: ShowStyle, functionId: string, context: TemplateContextInner, reason: string): TemplateGeneralFunction {
	let fcn: null | TemplateGeneralFunction = null
	let runtimeFunction = RuntimeFunctions.findOne({
		showStyleId: showStyle._id,
		active: true,
		templateId: functionId,
		isHelper: functionId === 'getId'
	})
	if (runtimeFunction && runtimeFunction.code) {
		try {
			fcn = convertCodeToFunction(context, runtimeFunction, reason)
		} catch (e) {
			throw new Meteor.Error(402, 'Syntax error in runtime function "' + functionId + '": ' + e.toString())
		}
	}
	if (fcn) {
		return fcn
	} else {
		throw new Meteor.Error(404, 'Function "' + functionId + '" not found!')
	}
}

export function runNamedTemplate (
	showStyle: ShowStyle,
	templateId: string,
	context: TemplateContext,
	story: IMOSROFullStory | null,
	reason: string,
	notes: Array<SegmentLineNote> = []
): TemplateResultAfterPost {
	let innerContext = getContext(context, false, story || undefined)
	let fcn = findFunction(showStyle, templateId, innerContext, reason)
	let result: TemplateResult = fcn(story) as TemplateResult
	notes = notes.concat(innerContext.getNotes()) // Add notes

	// logger.debug('runNamedTemplate', templateId)
	// Post-process the result:
	let i = 0
	let segmentLinesUniqueIds: { [id: string]: true } = {}
	let resultAfterPost: TemplateResultAfterPost = {
		notes: notes,
		segmentLine: result.segmentLine,
		segmentLineItems: _.map(_.compact(result.segmentLineItems), (itemOrg: SegmentLineItemOptional) => {
			let item: SegmentLineItem = itemOrg as SegmentLineItem

			if (!item._id) item._id = innerContext.getHashId('postprocess_' + (i++))
			if (!item.runningOrderId) item.runningOrderId = innerContext.runningOrderId
			if (!item.segmentLineId) item.segmentLineId = innerContext.segmentLine._id
			if (!item.mosId && !item.isTransition) throw new Meteor.Error(400, 'Error in template "' + templateId + '": mosId not set for segmentLineItem in ' + innerContext.segmentLine._id + '! ("' + innerContext.unhashId(item._id) + '")')

			if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of segmentLines must be unique! ("' + innerContext.unhashId(item._id) + '")')
			segmentLinesUniqueIds[item._id] = true

			if (item.content && item.content.timelineObjects) {
				item.content.timelineObjects = _.compact(item.content.timelineObjects)

				let timelineUniqueIds: { [id: string]: true } = {}
				_.each(item.content.timelineObjects, (o: TimelineObj) => {

					if (!o._id) o._id = innerContext.getHashId('postprocess_' + (i++))

					if (timelineUniqueIds[o._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of segmentLines must be unique! ("' + innerContext.unhashId(o._id) + '")')
					timelineUniqueIds[o._id] = true
				})
			}

			return item
		}),
		segmentLineAdLibItems: result.segmentLineAdLibItems ? _.map(_.compact(result.segmentLineAdLibItems), (itemOrg: SegmentLineAdLibItemOptional) => {
			let item: SegmentLineAdLibItem = itemOrg as SegmentLineAdLibItem

			if (!item._id) item._id = innerContext.getHashId('postprocess_' + (i++))
			if (!item.runningOrderId) item.runningOrderId = innerContext.runningOrderId
			if (!item.segmentLineId) item.segmentLineId = innerContext.segmentLine._id
			if (!item.mosId) throw new Meteor.Error(400, 'Error in template "' + templateId + '": mosId not set for segmentLineItem in ' + innerContext.segmentLine._id + '! ("' + innerContext.unhashId(item._id) + '")')

			if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of segmentLines must be unique! ("' + innerContext.unhashId(item._id) + '")')
			segmentLinesUniqueIds[item._id] = true

			if (item.content && item.content.timelineObjects) {
				item.content.timelineObjects = _.compact(item.content.timelineObjects)

				let timelineUniqueIds: { [id: string]: true } = {}
				_.each(item.content.timelineObjects, (o: TimelineObj) => {

					if (!o._id) o._id = innerContext.getHashId('postprocess_' + (i++))

					if (timelineUniqueIds[o._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of segmentLines must be unique! ("' + innerContext.unhashId(o._id) + '")')
					timelineUniqueIds[o._id] = true
				})
			}

			return item
		}) : null,
		baselineItems: result.baselineItems ? _.map(_.compact(result.baselineItems), (itemOrg: RunningOrderBaselineItemOptional) => {
			let item: RunningOrderBaselineItem = itemOrg as RunningOrderBaselineItem

			if (!item._id) item._id = innerContext.getHashId('postprocess_' + (i++))
			if (!item.runningOrderId) item.runningOrderId = innerContext.runningOrderId
			item.segmentLineId = undefined

			if (segmentLinesUniqueIds[item._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of segmentLines must be unique! ("' + innerContext.unhashId(item._id) + '")')
			segmentLinesUniqueIds[item._id] = true

			if (item.content && item.content.timelineObjects) {
				item.content.timelineObjects = _.compact(item.content.timelineObjects)

				let timelineUniqueIds: { [id: string]: true } = {}
				_.each(item.content.timelineObjects, (o: TimelineObj) => {

					if (!o._id) o._id = innerContext.getHashId('postprocess_' + (i++))

					if (timelineUniqueIds[o._id]) throw new Meteor.Error(400, 'Error in template "' + templateId + '": ids of segmentLines must be unique! ("' + innerContext.unhashId(o._id) + '")')
					timelineUniqueIds[o._id] = true
				})
			}

			return item
		}) : null
	}
	return resultAfterPost
}
export interface RunTemplateResult {
	templateId: string
	result: TemplateResultAfterPost
}
export function runTemplate (showStyle: ShowStyle, context: TemplateContext, story: IMOSROFullStory, reason: string): RunTemplateResult | undefined {
	let notes: Array<SegmentLineNote> = []
	let innerContext0 = getContext(context, false, story)
	let getId = findFunction(showStyle, 'getId', innerContext0, reason)

	let templateId: string | null = getId(story) as string | null
	notes = notes.concat(innerContext0.getNotes()) // Add notes
	/*
		The getId template can return the following things:
		'templateName'		The name of the template to run
		'' (empty string): 	"No template was found"
		null: 				"Ignore silently"
	*/

	if (templateId === null) {
		// the template is specifically telling us to ignore it
		// Do nothing
	} else if (templateId) {
		let context0 = _.extend({}, context, {
			templateId: templateId
		})
		let result = runNamedTemplate(showStyle, templateId, context0, story, reason, notes)

		return {
			templateId: templateId,
			result: result
		}
	} else {
		let name = context.segmentLine.mosId
		if (story && story.Slug) {
			name = story.Slug.toString()
		}
		notes.push({
			type: SegmentLineNoteType.ERROR,
			origin: {
				name: name,
				roId: context.runningOrderId,
				segmentId: context.segmentLine.segmentId,
				segmentLineId: context.segmentLine._id,
			},
			message: 'No template id found for story "' + story.ID + '" ("' + story.Slug + '")'
		})

		return {
			templateId: '',
			result: {
				notes: notes,
				segmentLine: null, 			// DBSegmentLine | null,
				segmentLineItems: [], 		// Array<SegmentLineItem> | null
				segmentLineAdLibItems: [], 	// Array<SegmentLineAdLibItem> | null
				baselineItems: [] 			// Array<RunningOrderBaselineItem> | null
			}
		}
		// throw new Meteor.Error(500, 'No template id found for story "' + story.ID + '" ("' + story.Slug + '")')
	}
}
