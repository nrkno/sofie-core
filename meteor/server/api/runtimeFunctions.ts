import { RuntimeFunctionsAPI } from '../../lib/api/runtimeFunctions'
import { getCurrentTime, literal } from '../../lib/lib'
import { RuntimeFunctions } from '../../lib/collections/RuntimeFunctions'
import * as _ from 'underscore'
import { check } from 'meteor/check'
import { Random } from 'meteor/random'
import { convertCodeToFunction, getContext, TemplateContext, TemplateResult, TemplateGeneralFunction } from './templates/templates'
import { DBSegmentLine, SegmentLine } from '../../lib/collections/SegmentLines'
import { IMOSROFullStory, MosString128, IMOSItem } from 'mos-connection'

export function runtimeFunctionTestCode (code: string) {
	check(code, String)
	console.log('runtimeFunctionTestCode')

	let fcn: TemplateGeneralFunction
	try {
		let tmpSegmentLine: DBSegmentLine = {
			_id: 'ROID',
			_rank: 0,
			mosId: '',
			segmentId: '',
			runningOrderId: '',
			slug: '',
			// autoNext?: boolean
			// metaData?: Array<IMOSExternalMetaData>
			// status?: IMOSObjectStatus
			// expectedDuration?: number
			// startedPlayback?: number
			// duration?: number
			// overlapDuration?: number
			// disableOutTransition?: boolean
		}
		let tmpContext: TemplateContext = {
			runningOrderId: 'myRunningOrder',
			// segment: Segment
			segmentLine: new SegmentLine(tmpSegmentLine)
		}
		let innerContext = getContext(tmpContext)
		fcn = convertCodeToFunction(innerContext, code)

	} catch (e) {
		throw new Meteor.Error(402, 'Syntax error in runtime function: ' + e.toString() + ' \n' + e.stack)
	}

	// Test the result:

	let tmpStory: IMOSROFullStory = {
		ID: new MosString128('asdf'),
		// Slug?: new MosString128(''),
		// Number?: new MosString128(''),
		// MosExternalMetaData?: Array<IMOSExternalMetaData>
		RunningOrderId: new MosString128('ROID'),
		Body: [{
			Type: 'myTmpType',
			Content: literal<IMOSItem>({ // IMOSItem
				ID: new MosString128('asdf'),
				// Slug?: new MosString128('')
				ObjectID: new MosString128('asdf'),
				MOSID: 'myMosItemId'
				// mosAbstract?: string
				// Paths?: Array<IMOSObjectPath>
				// Channel?: new MosString128('')
				// EditorialStart?: number
				// EditorialDuration?: number
				// UserTimingDuration?: number
				// Trigger?: any
				// MacroIn?: new MosString128('')
				// MacroOut?: new MosString128('')
				// MosExternalMetaData?: Array<IMOSExternalMetaData>
				// MosObjects?: Array<IMOSObject>
			})
		}]
	}
	let result: TemplateResult = fcn(tmpStory) as TemplateResult

	if (!result.segmentLine) throw new Meteor.Error(400, 'Error in function result: .segmentLine not found') // : DBSegmentLine | null,
	if (!result.segmentLineItems) throw new Meteor.Error(400, 'Error in function result: .segmentLineItems not found') // : Array<SegmentLineItemOptional> | null
	if (!result.segmentLineAdLibItems) throw new Meteor.Error(400, 'Error in function result: .segmentLineAdLibItems not found') // : Array<SegmentLineAdLibItemOptional> | null
	if (!result.baselineItems) throw new Meteor.Error(400, 'Error in function result: .baselineItems not found') // ?: Array<RunningOrderBaselineItemOptional> | null

	return true
}
export function runtimeFunctionUpdateCode (runtimeFunctionId: string, code: string) {
	check(runtimeFunctionId, String)
	check(code, String)
	let oldRf = RuntimeFunctions.findOne(runtimeFunctionId)

	if (!oldRf) throw new Meteor.Error(404, 'RuntimeFunction "' + runtimeFunctionId + '" not found!')

	runtimeFunctionTestCode(code)

	if (
		!oldRf.modified ||
		(getCurrentTime() - (oldRf.modified || 0)) > 3600 * 1000 ||
		!oldRf.active
	) {
		// Create a new version:
		// (i.e make a copy)
		RuntimeFunctions.insert(_.extend(
			_.omit(oldRf, '_id'),
			{
				active: false
			}
		))
		// Update
		RuntimeFunctions.update(oldRf._id, {$set: {
			code: code,
			createdVersion: getCurrentTime(),
			modified: getCurrentTime(),
			active: true
		}})
	} else {
		// Update the current version
		RuntimeFunctions.update(oldRf._id, {$set: {
			code: code,
			modified: getCurrentTime()
		}})
	}
}
export function runtimeFunctionUpdateTemplateId (runtimeFunctionId: string, templateId: string) {
	check(runtimeFunctionId, String)
	check(templateId, String)

	let oldRf = RuntimeFunctions.findOne(runtimeFunctionId)
	if (!oldRf) throw new Meteor.Error(404, 'RuntimeFunction "' + runtimeFunctionId + '" not found!')

	let anyExisting = RuntimeFunctions.find({
		templateId: 	templateId,
		showStyleId: 	oldRf.showStyleId,
	}).count()

	if (anyExisting > 0) throw new Meteor.Error(401, 'Cannot change templateId to "' + templateId + '", it already exists!')

	RuntimeFunctions.update({
		templateId: 	oldRf.templateId,
		showStyleId: 	oldRf.showStyleId,
	}, {$set: {
		templateId: 	templateId
	}}, {
		multi: true
	})
}
export function runtimeFunctionInsert (showStyleId: string) {
	check(showStyleId, String)

	return RuntimeFunctions.insert({
		_id: Random.id(),
		templateId: Random.hexString(5),
		showStyleId: showStyleId,
		createdVersion: getCurrentTime(),
		modified: 0,
		active: true,
		code: (
`"use strict";
/**
 * Note: Do not modify the params in this description.
 * @param {Context} context
 * @param {Story} story
 */
function template (context, story) {
	return {
		segmentLine: {
			_id: '',
			_rank: 0,
			mosId: '',
			segmentId: '',
			runningOrderId: '',
			slug: context.segmentLine._id,
			autoNext: false,
			overlapDuration: 0,
		},
		segmentLineItems: [],
		segmentLineAdLibItems: []
	}
}`
		)
	})
}
export function runtimeFunctionRemove (runtimeFunctionId: string, confirm: boolean) {
	check(runtimeFunctionId, String)
	check(confirm, Boolean)
	let oldRf = RuntimeFunctions.findOne(runtimeFunctionId)

	if (!oldRf) throw new Meteor.Error(404, 'RuntimeFunction "' + runtimeFunctionId + '" not found!')

	RuntimeFunctions.remove({
		templateId: oldRf.templateId
	})
}

let methods = {}
methods[RuntimeFunctionsAPI.UPDATECODE] = runtimeFunctionUpdateCode
methods[RuntimeFunctionsAPI.TESTCODE] = runtimeFunctionTestCode
methods[RuntimeFunctionsAPI.UPDATETEMPLATEID] = runtimeFunctionUpdateTemplateId
methods[RuntimeFunctionsAPI.INSERT] = runtimeFunctionInsert
methods[RuntimeFunctionsAPI.REMOVE] = runtimeFunctionRemove
Meteor.methods(methods)
