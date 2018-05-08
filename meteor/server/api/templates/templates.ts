import * as _ from 'underscore'
import * as saferEval from 'safer-eval'
import {
	IMOSConnectionStatus,
	IMOSDevice,
	IMOSListMachInfo,
	MosString128,
	MosTime,
	IMOSRunningOrder,
	IMOSRunningOrderBase,
	IMOSRunningOrderStatus,
	IMOSStoryStatus,
	IMOSItemStatus,
	IMOSStoryAction,
	IMOSROStory,
	IMOSROAction,
	IMOSItemAction,
	IMOSItem,
	IMOSROReadyToAir,
	IMOSROFullStory,
	IMOSStory,
	IMOSExternalMetaData
} from 'mos-connection'
import { RuntimeFunctions } from '../../../lib/collections/RuntimeFunctions'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'

export type TemplateGeneralFunction = (story: IMOSROFullStory) => any
export type TemplateFunction = (story: IMOSROFullStory) => Array<SegmentLineItem>
export type TemplateFunctionOptional = (story: IMOSROFullStory) => Array<SegmentLineItemOptional>

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
type Optional<T> = {
	[K in keyof T]?: T[K]
}
export type SegmentLineItemOptional = Optional<SegmentLineItem>

export interface TemplateSet {
	getId: (story: IMOSROFullStory) => string
	templates: {
		[key: string]: TemplateFunctionOptional
	}
}
export interface TemplateContext {
	segment: Segment
	segmentLine: SegmentLine
}
export interface TemplateContextInner extends TemplateContext {
	id: () => string
}
function getContext (context: TemplateContext): TemplateContextInner {
	return _.extend({
		id () {
			return Random.id()
		}
	}, context)
}

import { nrk } from './nrk'
let template: TemplateSet = nrk

function findFunction (functionId: string, context: TemplateContextInner): TemplateGeneralFunction {
	let fcn: null | TemplateGeneralFunction = null
	let runtimeFunction = RuntimeFunctions.findOne(functionId)
	if (runtimeFunction && runtimeFunction.code) {

		// Note: the functions will be without the preceeding "function () {" and the ending "}"
		let functionStr = 'return function (story) { ' + runtimeFunction.code + '}'
		try {
			let runtimeFcn: TemplateGeneralFunction = saferEval(functionStr, {})
			fcn = (story) => {
				let result = runtimeFcn.apply(context, [story])
				return result
			}
		} catch (e) {
			throw new Meteor.Error(402, 'Syntax error in runtime function "' + functionId + '": ' + e.toString())
		}
	} else {
		// resort to built-in functions:
		if (functionId === 'getId') {
			fcn = template.getId
		} else {
			fcn = template.templates[functionId]
		}
	}
	if (fcn) {
		return fcn
	} else {
		throw new Meteor.Error(404, 'Function "' + functionId + '" not found!')
	}
}

export function runTemplate (context: TemplateContext, story: IMOSROFullStory): Array<SegmentLineItem> {
	let innerContext = getContext(context)
	let getId = findFunction('getId', innerContext)

	let templateId: string = getId(story)

	if (templateId) {
		let fcn = findFunction(templateId, innerContext)
		let results = fcn(story)

		// Post-process the result:
		return _.map(results, (itemOrg: SegmentLineItemOptional) => {
			let item: SegmentLineItem = itemOrg as SegmentLineItem

			if (!item._id) item._id = innerContext.id()
			if (!item.runningOrderId) item.runningOrderId = innerContext.segment.runningOrderId
			if (!item.segmentLineId) item.segmentLineId = innerContext.segmentLine._id

			return item
		})

	} else {
		throw new Meteor.Error(500, 'No id found for story "' + story.ID + '"')
	}
}
