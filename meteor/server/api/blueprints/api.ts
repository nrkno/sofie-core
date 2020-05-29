import * as _ from 'underscore'
import { getCurrentTime, protectString, unprotectString, getRandomId, makePromise, check } from '../../../lib/lib'
import { logger } from '../../logging'
import { Meteor } from 'meteor/meteor'
import { Blueprints, Blueprint, BlueprintId } from '../../../lib/collections/Blueprints'
import { BlueprintManifestType, SomeBlueprintManifest } from 'tv-automation-sofie-blueprints-integration'
import { Match } from 'meteor/check'
import { NewBlueprintAPI, BlueprintAPIMethods } from '../../../lib/api/blueprint'
import { registerClassToMeteorMethods } from '../../methods'
import { parseVersion, parseRange, CoreSystem, SYSTEM_ID } from '../../../lib/collections/CoreSystem'
import { evalBlueprints } from './cache'
import { removeSystemStatus } from '../../systemStatus/systemStatus'

export function insertBlueprint(type?: BlueprintManifestType, name?: string): BlueprintId {
	return Blueprints.insert({
		_id: getRandomId(),
		name: name || 'New Blueprint',
		code: '',
		modified: getCurrentTime(),
		created: getCurrentTime(),

		blueprintId: protectString(''),
		blueprintType: type,

		studioConfigManifest: [],
		showStyleConfigManifest: [],

		databaseVersion: {
			studio: {},
			showStyle: {},
		},

		blueprintVersion: '',
		integrationVersion: '',
		TSRVersion: '',
		minimumCoreVersion: '',
	})
}
export function removeBlueprint(blueprintId: BlueprintId) {
	check(blueprintId, String)
	if (!blueprintId) {
		throw new Meteor.Error(404, `Blueprint id "${blueprintId}" was not found`)
	}
	Blueprints.remove(blueprintId)
	removeSystemStatus('blueprintCompability_' + blueprintId)
}

export function uploadBlueprint(
	blueprintId: BlueprintId,
	body: string,
	blueprintName?: string,
	ignoreIdChange?: boolean
): Blueprint {
	check(blueprintId, String)
	check(body, String)
	check(blueprintName, Match.Maybe(String))

	if (!Meteor.isTest) logger.info(`Got blueprint '${blueprintId}'. ${body.length} bytes`)

	if (!blueprintId) {
		throw new Meteor.Error(400, `Blueprint id "${blueprintId}" is not valid`)
	}

	const existingBlueprint = Blueprints.findOne(blueprintId)

	const newBlueprint: Blueprint = {
		_id: blueprintId,
		name: existingBlueprint ? existingBlueprint.name : blueprintName || unprotectString(blueprintId),
		created: existingBlueprint ? existingBlueprint.created : getCurrentTime(),
		code: body,
		modified: getCurrentTime(),
		studioConfigManifest: [],
		showStyleConfigManifest: [],
		databaseVersion: existingBlueprint
			? existingBlueprint.databaseVersion
			: {
					studio: {},
					showStyle: {},
			  },
		blueprintId: protectString(''),
		blueprintVersion: '',
		integrationVersion: '',
		TSRVersion: '',
		minimumCoreVersion: '',
		blueprintType: undefined,
	}

	let blueprintManifest: SomeBlueprintManifest | undefined
	try {
		blueprintManifest = evalBlueprints(newBlueprint, false)
	} catch (e) {
		throw new Meteor.Error(400, `Blueprint ${blueprintId} failed to parse`)
	}

	if (!_.isObject(blueprintManifest))
		throw new Meteor.Error(400, `Blueprint ${blueprintId} returned a manifest of type ${typeof blueprintManifest}`)

	if (!_.contains(_.values(BlueprintManifestType), blueprintManifest.blueprintType)) {
		throw new Meteor.Error(
			400,
			`Blueprint ${blueprintId} returned a manifest of unknown blueprintType "${blueprintManifest.blueprintType}"`
		)
	}

	newBlueprint.blueprintId = protectString(blueprintManifest.blueprintId || '')
	newBlueprint.blueprintType = blueprintManifest.blueprintType
	newBlueprint.blueprintVersion = blueprintManifest.blueprintVersion
	newBlueprint.integrationVersion = blueprintManifest.integrationVersion
	newBlueprint.TSRVersion = blueprintManifest.TSRVersion
	newBlueprint.minimumCoreVersion = blueprintManifest.minimumCoreVersion

	if (
		existingBlueprint &&
		existingBlueprint.blueprintType &&
		existingBlueprint.blueprintType !== newBlueprint.blueprintType
	) {
		throw new Meteor.Error(
			400,
			`Cannot replace old blueprint (of type "${existingBlueprint.blueprintType}") with new blueprint of type "${newBlueprint.blueprintType}"`
		)
	}
	if (
		existingBlueprint &&
		existingBlueprint.blueprintId &&
		existingBlueprint.blueprintId !== newBlueprint.blueprintId
	) {
		if (ignoreIdChange) {
			logger.warn(
				`Replacing blueprint "${newBlueprint._id}" ("${existingBlueprint.blueprintId}") with new blueprint "${newBlueprint.blueprintId}"`
			)

			// Force reset migrations
			newBlueprint.databaseVersion = {
				showStyle: {},
				studio: {},
			}
		} else {
			throw new Meteor.Error(
				422,
				`Cannot replace old blueprint "${newBlueprint._id}" ("${existingBlueprint.blueprintId}") with new blueprint "${newBlueprint.blueprintId}"`
			)
		}
	}

	if (blueprintManifest.blueprintType === BlueprintManifestType.SHOWSTYLE) {
		newBlueprint.showStyleConfigManifest = blueprintManifest.showStyleConfigManifest
	}
	if (blueprintManifest.blueprintType === BlueprintManifestType.STUDIO) {
		newBlueprint.studioConfigManifest = blueprintManifest.studioConfigManifest
	}

	// Parse the versions, just to verify that the format is correct:
	parseVersion(blueprintManifest.blueprintVersion)
	parseVersion(blueprintManifest.integrationVersion)
	parseVersion(blueprintManifest.TSRVersion)
	parseRange(blueprintManifest.minimumCoreVersion)

	Blueprints.upsert(newBlueprint._id, newBlueprint)
	return newBlueprint
}

function assignSystemBlueprint(blueprintId?: BlueprintId) {
	if (blueprintId !== undefined && blueprintId !== null) {
		check(blueprintId, String)

		const blueprint = Blueprints.findOne(blueprintId)
		if (!blueprint) throw new Meteor.Error(404, 'Blueprint not found')

		if (blueprint.blueprintType !== BlueprintManifestType.SYSTEM)
			throw new Meteor.Error(404, 'Blueprint not of type SYSTEM')

		CoreSystem.update(SYSTEM_ID, {
			$set: {
				blueprintId: blueprintId,
			},
		})
	} else {
		CoreSystem.update(SYSTEM_ID, {
			$unset: {
				blueprintId: 1,
			},
		})
	}
}

class ServerBlueprintAPI implements NewBlueprintAPI {
	insertBlueprint() {
		return makePromise(() => insertBlueprint())
	}
	removeBlueprint(blueprintId: BlueprintId) {
		return makePromise(() => removeBlueprint(blueprintId))
	}
	assignSystemBlueprint(blueprintId?: BlueprintId) {
		return makePromise(() => assignSystemBlueprint(blueprintId))
	}
}
registerClassToMeteorMethods(BlueprintAPIMethods, ServerBlueprintAPI, false)
