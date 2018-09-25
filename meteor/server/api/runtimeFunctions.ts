import { RuntimeFunctionsAPI } from '../../lib/api/runtimeFunctions'
import { getCurrentTime, literal } from '../../lib/lib'
import { RuntimeFunctions, RuntimeFunction } from '../../lib/collections/RuntimeFunctions'
import * as _ from 'underscore'
import { check } from 'meteor/check'
import { Random } from 'meteor/random'
import { convertCodeToGeneralFunction, convertCodeToFunction, getContext, TemplateContext, TemplateResult, TemplateGeneralFunction, TemplateContextInternalBase, LayerType, preventSaveDebugData } from './templates/templates'
import { DBSegmentLine, SegmentLine } from '../../lib/collections/SegmentLines'
import { IMOSROFullStory, MosString128, IMOSItem } from 'mos-connection'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { logger } from '../logging'
import { Meteor } from 'meteor/meteor'
import { RunningOrder, DBRunningOrder } from '../../lib/collections/RunningOrders'

export function runtimeFunctionTestCode (runtimeFunction: RuntimeFunction, showStyleId: string, syntaxOnly: boolean) {
	check(runtimeFunction.code, String)
	logger.debug('runtimeFunctionTestCode')

	if (syntaxOnly) {
		try {
			convertCodeToGeneralFunction(runtimeFunction, 'test')
			preventSaveDebugData()
		} catch (e) {
			throw new Meteor.Error(402, 'Syntax error in runtime function: ' + e.toString() + ' \n' + e.stack)
		}
		return true
	}

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
			// disableOutTransition?: boolean
		}
		let tmpRunningOrder: DBRunningOrder = {
			_id: 'myRunningOrder',
			mosId: '',
			studioInstallationId: '',
			showStyleId: '',
			mosDeviceId: '',
			name: '',
			created: 1234,
			modified: 1235,
			currentSegmentLineId: null,
			nextSegmentLineId: null,
			previousSegmentLineId: null

		}
		let tmpContext: TemplateContext = {
			runningOrderId: 'myRunningOrder',
			runningOrder: new RunningOrder(tmpRunningOrder),
			studioId: 'myStudio',
			// segment: Segment
			segmentLine: new SegmentLine(tmpSegmentLine),
			templateId: runtimeFunction._id
		}

		let innerContext = getContext(tmpContext)
		innerContext.getRunningOrder = () => { throw new Meteor.Error(404, 'Not done yet') }
		innerContext.getShowStyleId = () => showStyleId
		innerContext.getStudioInstallation = () => {
			const studio = StudioInstallations.findOne()
			if (!studio) throw new Meteor.Error(404, 'No StudioInstallation found')
			return studio
		}
		innerContext.getSegmentLines = () => []

		fcn = convertCodeToFunction(innerContext, runtimeFunction, 'test')
		preventSaveDebugData()

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
	let result: TemplateResult| undefined
	try {
		result = fcn(tmpStory) as TemplateResult
	} catch (e) {
		throw new Meteor.Error(402, 'Runtime error in runtime function: ' + e.toString() + ' \n' + e.stack)
	}

	if (!result) throw new Meteor.Error(400, 'Unknown error in function result')
	if (result.segmentLine === undefined) throw new Meteor.Error(400, 'Error in function result: .segmentLine not found') // : DBSegmentLine | null,
	if (result.segmentLineItems === undefined) throw new Meteor.Error(400, 'Error in function result: .segmentLineItems not found') // : Array<SegmentLineItemOptional> | null
	if (result.segmentLineAdLibItems === undefined) throw new Meteor.Error(400, 'Error in function result: .segmentLineAdLibItems not found') // : Array<SegmentLineAdLibItemOptional> | null

	return true
}
export function runtimeFunctionUpdateCode (runtimeFunctionId: string, code: string) {
	check(runtimeFunctionId, String)
	check(code, String)
	let oldRf = RuntimeFunctions.findOne(runtimeFunctionId)

	if (!oldRf) throw new Meteor.Error(404, 'RuntimeFunction "' + runtimeFunctionId + '" not found!')

	let tmpRf: RuntimeFunction = _.extend({}, oldRf, {
		code: code
	})
	runtimeFunctionTestCode(tmpRf, oldRf.showStyleId, oldRf.isHelper)

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
export function runtimeFunctionUpdateIsHelper (runtimeFunctionId: string, isHelper: boolean) {
	check(runtimeFunctionId, String)
	check(isHelper, Boolean)
	let oldRf = RuntimeFunctions.findOne(runtimeFunctionId)

	if (!oldRf) throw new Meteor.Error(404, 'RuntimeFunction "' + runtimeFunctionId + '" not found!')
	if (oldRf.templateId === 'getId') throw new Meteor.Error(500, 'RuntimeFunction "' + oldRf.templateId + '" have helper status changed!')

	// Update the current version
	RuntimeFunctions.update(oldRf._id, {$set: {
		isHelper: isHelper,
		modified: getCurrentTime()
	}})
}
export function runtimeFunctionUpdateTemplateId (runtimeFunctionId: string, templateId: string) {
	check(runtimeFunctionId, String)
	check(templateId, String)

	let oldRf = RuntimeFunctions.findOne(runtimeFunctionId)
	if (!oldRf) throw new Meteor.Error(404, 'RuntimeFunction "' + runtimeFunctionId + '" not found!')
	if (oldRf.templateId === 'getId') throw new Meteor.Error(500, 'RuntimeFunction "' + oldRf.templateId + '" cannot be renamed!')

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
		isHelper: false,
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
	if (oldRf.templateId === 'getId') throw new Meteor.Error(500, 'RuntimeFunction "' + oldRf.templateId + '" cannot be removed!')

	RuntimeFunctions.remove({
		templateId: oldRf.templateId
	})
}

let methods = {}
methods[RuntimeFunctionsAPI.UPDATECODE] = runtimeFunctionUpdateCode
methods[RuntimeFunctionsAPI.TESTCODE] = runtimeFunctionTestCode
methods[RuntimeFunctionsAPI.UPDATETEMPLATEID] = runtimeFunctionUpdateTemplateId
methods[RuntimeFunctionsAPI.UPDATEISHELPER] = runtimeFunctionUpdateIsHelper
methods[RuntimeFunctionsAPI.INSERT] = runtimeFunctionInsert
methods[RuntimeFunctionsAPI.REMOVE] = runtimeFunctionRemove
Meteor.methods(methods)
