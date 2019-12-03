import * as _ from 'underscore'
import { getCurrentTime } from '../../../lib/lib'
import { logger } from '../../logging'
import { Meteor } from 'meteor/meteor'
import { Blueprints, Blueprint } from '../../../lib/collections/Blueprints'
import {
	BlueprintManifestType,
	SomeBlueprintManifest,
} from 'tv-automation-sofie-blueprints-integration'
import { Random } from 'meteor/random'
import { check, Match } from 'meteor/check'
import { BlueprintAPI } from '../../../lib/api/blueprint'
import { Methods, setMeteorMethods } from '../../methods'
import { parseVersion, parseRange, CoreSystem, SYSTEM_ID } from '../../../lib/collections/CoreSystem'
import { evalBlueprints } from './cache'
import { removeSystemStatus } from '../../systemStatus/systemStatus'

export function insertBlueprint (type?: BlueprintManifestType, name?: string): string {
	return Blueprints.insert({
		_id: Random.id(),
		name: name || 'New Blueprint',
		code: '',
		modified: getCurrentTime(),
		created: getCurrentTime(),

		blueprintType: type,

		studioConfigManifest: [],
		showStyleConfigManifest: [],

		databaseVersion: {
			studio: {},
			showStyle: {}
		},

		blueprintVersion: '',
		integrationVersion: '',
		TSRVersion: '',
		minimumCoreVersion: ''
	})
}
export function removeBlueprint (id: string) {
	check(id, String)
	if (!id) {
		throw new Meteor.Error(404, `Blueprint id "${id}" was not found`)
	}
	Blueprints.remove(id)
	removeSystemStatus('blueprintCompability_' + id)
}

export function uploadBlueprint (blueprintId: string, body: string, blueprintName?: string): Blueprint {
	check(blueprintId, String)
	check(body, String)
	check(blueprintName, Match.Maybe(String))

	logger.info(`Got blueprint '${blueprintId}'. ${body.length} bytes`)

	if (!blueprintId) {
		throw new Meteor.Error(400, `Blueprint id "${blueprintId}" is not valid`)
	}

	const existingBlueprint = Blueprints.findOne(blueprintId)

	const newBlueprint: Blueprint = {
		_id: blueprintId,
		name: existingBlueprint ? existingBlueprint.name : (blueprintName || blueprintId),
		created: existingBlueprint ? existingBlueprint.created : getCurrentTime(),
		code: body,
		modified: getCurrentTime(),
		studioConfigManifest: [],
		showStyleConfigManifest: [],
		databaseVersion: {
			studio: {},
			showStyle: {}
		},
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

	if (!_.isObject(blueprintManifest)) throw new Meteor.Error(400, `Blueprint ${blueprintId} returned a manifest of type ${typeof blueprintManifest}`)

	if (!_.contains(_.values(BlueprintManifestType), blueprintManifest.blueprintType)) {
		throw new Meteor.Error(400, `Blueprint ${blueprintId} returned a manifest of unknown blueprintType "${blueprintManifest.blueprintType}"`)
	}

	newBlueprint.blueprintType				= blueprintManifest.blueprintType
	newBlueprint.blueprintVersion			= blueprintManifest.blueprintVersion
	newBlueprint.integrationVersion			= blueprintManifest.integrationVersion
	newBlueprint.TSRVersion					= blueprintManifest.TSRVersion
	newBlueprint.minimumCoreVersion			= blueprintManifest.minimumCoreVersion

	if (
		existingBlueprint &&
		existingBlueprint.blueprintType &&
		existingBlueprint.blueprintType !== newBlueprint.blueprintType
	) {
		throw new Meteor.Error(400, `Cannot replace old blueprint (of type "${existingBlueprint.blueprintType}") with new blueprint of type "${newBlueprint.blueprintType}"`)
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

function assignSystemBlueprint (id?: string) {
	if (id !== undefined && id !== null) {
		check(id, String)

		const blueprint = Blueprints.findOne(id)
		if (!blueprint) throw new Meteor.Error(404, 'Blueprint not found')

		if (blueprint.blueprintType !== BlueprintManifestType.SYSTEM) throw new Meteor.Error(404, 'Blueprint not of type SYSTEM')

		CoreSystem.update(SYSTEM_ID, {
			$set: {
				blueprintId: id
			}
		})
	} else {
		CoreSystem.update(SYSTEM_ID, {
			$unset: {
				blueprintId: 1
			}
		})
	}
}

let methods: Methods = {}
methods[BlueprintAPI.methods.insertBlueprint] = () => {
	return insertBlueprint()
}
methods[BlueprintAPI.methods.removeBlueprint] = (id: string) => {
	return removeBlueprint(id)
}
methods[BlueprintAPI.methods.assignSystemBlueprint] = (id?: string) => {
	return assignSystemBlueprint(id)
}
setMeteorMethods(methods)
