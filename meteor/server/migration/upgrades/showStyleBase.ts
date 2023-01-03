import { BlueprintManifestType, ShowStyleBlueprintManifest } from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { normalizeArray, normalizeArrayToMap, getRandomId, literal, Complete } from '@sofie-automation/corelib/dist/lib'
import {
	applyAndValidateOverrides,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { wrapTranslatableMessageFromBlueprints } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { BlueprintValidateConfigForStudioResult } from '@sofie-automation/corelib/dist/worker/studio'
import { Meteor } from 'meteor/meteor'
import { Blueprints } from '../../../lib/collections/Blueprints'
import { ShowStyleBases, ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { TriggeredActions, DBTriggeredActions } from '../../../lib/collections/TriggeredActions'
import { evalBlueprint } from '../../api/blueprints/cache'
import { logger } from '../../logging'
import { CommonContext } from './context'
import type { AnyBulkWriteOperation } from 'mongodb'

export async function validateConfigForShowStyleBase(
	showStyleBaseId: ShowStyleBaseId
): Promise<BlueprintValidateConfigForStudioResult> {
	const showStyleBase = (await ShowStyleBases.findOneAsync(showStyleBaseId, {
		fields: {
			_id: 1,
			blueprintId: 1,
			blueprintConfigPresetId: 1,
			blueprintConfigWithOverrides: 1,
		},
	})) as
		| Pick<ShowStyleBase, '_id' | 'blueprintId' | 'blueprintConfigPresetId' | 'blueprintConfigWithOverrides'>
		| undefined
	if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase "${showStyleBaseId}" not found!`)

	if (!showStyleBase.blueprintConfigPresetId) throw new Meteor.Error(500, 'ShowStyleBase is missing config preset')

	const blueprint = showStyleBase.blueprintId
		? await Blueprints.findOneAsync({
				_id: showStyleBase.blueprintId,
				blueprintType: BlueprintManifestType.SHOWSTYLE,
		  })
		: undefined
	if (!blueprint) throw new Meteor.Error(404, `Blueprint "${showStyleBase.blueprintId}" not found!`)

	if (!blueprint.blueprintHash) throw new Meteor.Error(500, 'Blueprint is not valid')

	const blueprintManifest = evalBlueprint(blueprint) as ShowStyleBlueprintManifest

	if (typeof blueprintManifest.validateConfig !== 'function')
		throw new Meteor.Error(500, 'Blueprint does not support this config flow')

	const blueprintContext = new CommonContext(
		'applyConfig',
		`showStyleBase:${showStyleBaseId},blueprint:${blueprint._id}`
	)
	const rawBlueprintConfig = applyAndValidateOverrides(showStyleBase.blueprintConfigWithOverrides).obj

	const messages = blueprintManifest.validateConfig(blueprintContext, rawBlueprintConfig)

	return {
		messages: messages.map((msg) => ({
			level: msg.level,
			message: wrapTranslatableMessageFromBlueprints(msg.message, [blueprint._id]),
		})),
	}
}

export async function runUpgradeForShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void> {
	logger.info(`Running upgrade for ShowStyleBase "${showStyleBaseId}"`)

	const showStyleBase = (await ShowStyleBases.findOneAsync(showStyleBaseId, {
		fields: {
			_id: 1,
			blueprintId: 1,
			blueprintConfigPresetId: 1,
			blueprintConfigWithOverrides: 1,
		},
	})) as
		| Pick<ShowStyleBase, '_id' | 'blueprintId' | 'blueprintConfigPresetId' | 'blueprintConfigWithOverrides'>
		| undefined
	if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase "${showStyleBaseId}" not found!`)

	if (!showStyleBase.blueprintConfigPresetId) throw new Meteor.Error(500, 'ShowStyleBase is missing config preset')

	const blueprint = showStyleBase.blueprintId
		? await Blueprints.findOneAsync({
				_id: showStyleBase.blueprintId,
				blueprintType: BlueprintManifestType.SHOWSTYLE,
		  })
		: undefined
	if (!blueprint) throw new Meteor.Error(404, `Blueprint "${showStyleBase.blueprintId}" not found!`)

	if (!blueprint.blueprintHash) throw new Meteor.Error(500, 'Blueprint is not valid')

	const blueprintManifest = evalBlueprint(blueprint) as ShowStyleBlueprintManifest

	if (typeof blueprintManifest.applyConfig !== 'function')
		throw new Meteor.Error(500, 'Blueprint does not support this config flow')

	const blueprintContext = new CommonContext(
		'applyConfig',
		`showStyleBase:${showStyleBaseId},blueprint:${blueprint.blueprintId}`
	)
	const rawBlueprintConfig = applyAndValidateOverrides(showStyleBase.blueprintConfigWithOverrides).obj

	const result = blueprintManifest.applyConfig(blueprintContext, rawBlueprintConfig)

	await ShowStyleBases.updateAsync(showStyleBaseId, {
		$set: {
			'sourceLayersWithOverrides.defaults': normalizeArray(result.sourceLayers, '_id'),
			'outputLayersWithOverrides.defaults': normalizeArray(result.outputLayers, '_id'),
			lastBlueprintConfig: {
				blueprintHash: blueprint.blueprintHash,
				blueprintId: blueprint._id,
				blueprintConfigPresetId: showStyleBase.blueprintConfigPresetId,
				config: rawBlueprintConfig,
			},
		},
	})

	const oldTriggeredActionsArray = await TriggeredActions.findFetchAsync({
		showStyleBaseId: showStyleBaseId,
		blueprintUniqueId: { $ne: null },
	})
	const oldTriggeredActions = normalizeArrayToMap(oldTriggeredActionsArray, 'blueprintUniqueId')

	const newDocIds: TriggeredActionId[] = []
	const bulkOps: AnyBulkWriteOperation<DBTriggeredActions>[] = []

	for (const newTriggeredAction of result.triggeredActions) {
		const oldValue = oldTriggeredActions.get(newTriggeredAction._id)
		if (oldValue) {
			// Update an existing TriggeredAction
			newDocIds.push(oldValue._id)
			bulkOps.push({
				updateOne: {
					filter: {
						_id: oldValue._id,
					},
					update: {
						$set: {
							_rank: newTriggeredAction._rank,
							name: newTriggeredAction.name,
							'triggersWithOverrides.defaults': newTriggeredAction.triggers,
							'actionsWithOverrides.defaults': newTriggeredAction.actions,
						},
					},
				},
			})
		} else {
			// Insert a new TriggeredAction
			const newDocId = getRandomId<TriggeredActionId>()
			newDocIds.push(newDocId)
			bulkOps.push({
				insertOne: {
					document: literal<Complete<DBTriggeredActions>>({
						_id: newDocId,
						_rank: newTriggeredAction._rank,
						name: newTriggeredAction.name,
						showStyleBaseId: showStyleBaseId,
						blueprintUniqueId: newTriggeredAction._id,
						triggersWithOverrides: wrapDefaultObject(newTriggeredAction.triggers),
						actionsWithOverrides: wrapDefaultObject(newTriggeredAction.actions),
					}),
				},
			})
		}
	}

	// Remove any removed TriggeredAction
	// Future: should this orphan them or something? Will that cause issues if they get re-added?
	bulkOps.push({
		deleteMany: {
			filter: {
				showStyleBaseId: showStyleBaseId,
				blueprintUniqueId: { $ne: null },
				_id: { $nin: newDocIds },
			},
		},
	})

	await TriggeredActions.bulkWriteAsync(bulkOps)
}
