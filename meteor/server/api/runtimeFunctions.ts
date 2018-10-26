import { RuntimeFunctionsAPI } from '../../lib/api/runtimeFunctions'
import { getCurrentTime, literal } from '../../lib/lib'
import { RuntimeFunctions, RuntimeFunction } from '../../lib/collections/RuntimeFunctions'
import * as _ from 'underscore'
import { check } from 'meteor/check'
import { Random } from 'meteor/random'
import { logger } from '../logging'
import { Meteor } from 'meteor/meteor'
import { setMeteorMethods } from '../methods'

export function runtimeFunctionTestCode (runtimeFunction: RuntimeFunction, showStyleId: string, syntaxOnly: boolean) {
	check(runtimeFunction.code, String)
	logger.debug('runtimeFunctionTestCode')

	throw new Meteor.Error(402, 'Unsupported api call')
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
setMeteorMethods(methods)
