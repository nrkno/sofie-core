import * as _ from 'underscore'
import { getCurrentTime, protectString, unprotectString, getRandomId, makePromise } from '../../../lib/lib'
import { logger } from '../../logging'
import { Meteor } from 'meteor/meteor'
import { Blueprints, Blueprint, BlueprintId } from '../../../lib/collections/Blueprints'
import {
	BlueprintManifestType,
	SomeBlueprintManifest,
} from 'tv-automation-sofie-blueprints-integration'
import { check, Match } from '../../../lib/check'
import { NewBlueprintAPI, BlueprintAPIMethods } from '../../../lib/api/blueprint'
import { registerClassToMeteorMethods } from '../../methods'
import { parseVersion, parseRange, CoreSystem, SYSTEM_ID } from '../../../lib/collections/CoreSystem'
import { evalBlueprints } from './cache'
import { removeSystemStatus } from '../../systemStatus/systemStatus'
import { MethodContext, MethodContextAPI } from '../../../lib/api/methods'
import { OrganizationContentWriteAccess, OrganizationReadAccess } from '../../security/organization'
import { SystemWriteAccess } from '../../security/system'
import { OrganizationId } from '../../../lib/collections/Organization'
import { Credentials } from '../../security/lib/credentials'
import { Settings } from '../../../lib/Settings'

export function insertBlueprint (methodContext: MethodContext, type?: BlueprintManifestType, name?: string): BlueprintId {
	const { organizationId } = OrganizationContentWriteAccess.blueprint(methodContext)
	
	/** @todo Add check for superadmin once roles are active */
	if(Settings.enableUserAccounts) throw new Meteor.Error(401, 'Only Super Admins can upload blueprints')

	return Blueprints.insert({
		_id: getRandomId(),
		organizationId: organizationId,
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
			showStyle: {}
		},

		blueprintVersion: '',
		integrationVersion: '',
		TSRVersion: '',
		minimumCoreVersion: ''
	})
}
export function removeBlueprint (methodContext: MethodContext, blueprintId: BlueprintId) {
	check(blueprintId, String)
	OrganizationContentWriteAccess.blueprint(methodContext, blueprintId, true)
	if (!blueprintId) throw new Meteor.Error(404, `Blueprint id "${blueprintId}" was not found`)

	Blueprints.remove(blueprintId)
	removeSystemStatus('blueprintCompability_' + blueprintId)
}

export function uploadBlueprint (context: Credentials, blueprintId: BlueprintId, body: string, blueprintName?: string, ignoreIdChange?: boolean): Blueprint {
	check(blueprintId, String)
	check(body, String)
	check(blueprintName, Match.Maybe(String))

	// TODO: add access control here
	const { organizationId, blueprint } = OrganizationContentWriteAccess.blueprint(context, blueprintId, true)

	if (!blueprintId) throw new Meteor.Error(400, `Blueprint id "${blueprintId}" is not valid`)

	return innerUploadBlueprint(organizationId, blueprint, blueprintId, body, blueprintName, ignoreIdChange)
}
/** Only to be called from internal functions */
export function internalUploadBlueprint (
	blueprintId: BlueprintId,
	body: string,
	blueprintName?: string,
	ignoreIdChange?: boolean,
): Blueprint {
	const organizationId = null
	const blueprint = Blueprints.findOne(blueprintId)

	return innerUploadBlueprint(organizationId, blueprint, blueprintId, body, blueprintName, ignoreIdChange)
}
export function innerUploadBlueprint (
	organizationId: OrganizationId | null,
	blueprint: Blueprint | undefined,
	blueprintId: BlueprintId,
	body: string,
	blueprintName?: string,
	ignoreIdChange?: boolean,
): Blueprint {

	logger.info(`Got blueprint '${blueprintId}'. ${body.length} bytes`)

	const newBlueprint: Blueprint = {
		_id: blueprintId,
		organizationId: organizationId,
		name: blueprint ? blueprint.name : (blueprintName || unprotectString(blueprintId)),
		created: blueprint ? blueprint.created : getCurrentTime(),
		code: body,
		modified: getCurrentTime(),
		studioConfigManifest: [],
		showStyleConfigManifest: [],
		databaseVersion: blueprint ? blueprint.databaseVersion : {
			studio: {},
			showStyle: {}
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

	if (!_.isObject(blueprintManifest)) throw new Meteor.Error(400, `Blueprint ${blueprintId} returned a manifest of type ${typeof blueprintManifest}`)

	if (!_.contains(_.values(BlueprintManifestType), blueprintManifest.blueprintType)) {
		throw new Meteor.Error(400, `Blueprint ${blueprintId} returned a manifest of unknown blueprintType "${blueprintManifest.blueprintType}"`)
	}

	newBlueprint.blueprintId				= protectString(blueprintManifest.blueprintId || '')
	newBlueprint.blueprintType				= blueprintManifest.blueprintType
	newBlueprint.blueprintVersion			= blueprintManifest.blueprintVersion
	newBlueprint.integrationVersion			= blueprintManifest.integrationVersion
	newBlueprint.TSRVersion					= blueprintManifest.TSRVersion
	newBlueprint.minimumCoreVersion			= blueprintManifest.minimumCoreVersion

	if (
		blueprint &&
		blueprint.blueprintType &&
		blueprint.blueprintType !== newBlueprint.blueprintType
	) {
		throw new Meteor.Error(400, `Cannot replace old blueprint (of type "${blueprint.blueprintType}") with new blueprint of type "${newBlueprint.blueprintType}"`)
	}
	if (blueprint && blueprint.blueprintId && blueprint.blueprintId !== newBlueprint.blueprintId) {
		if (ignoreIdChange) {
			logger.warn(`Replacing blueprint "${newBlueprint._id}" ("${blueprint.blueprintId}") with new blueprint "${newBlueprint.blueprintId}"`)

			// Force reset migrations
			newBlueprint.databaseVersion = {
				showStyle: {},
				studio: {}
			}
		} else {
			throw new Meteor.Error(422, `Cannot replace old blueprint "${newBlueprint._id}" ("${blueprint.blueprintId}") with new blueprint "${newBlueprint.blueprintId}"`)
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

function assignSystemBlueprint (methodContext: MethodContext, blueprintId?: BlueprintId) {
	SystemWriteAccess.coreSystem(methodContext)

	if (blueprintId !== undefined && blueprintId !== null) {
		check(blueprintId, String)

		const blueprint = Blueprints.findOne(blueprintId)
		if (!blueprint) throw new Meteor.Error(404, 'Blueprint not found')

		if (blueprint.organizationId) OrganizationReadAccess.organizationContent({ organizationId: blueprint.organizationId }, { userId: methodContext.userId })

		if (blueprint.blueprintType !== BlueprintManifestType.SYSTEM) throw new Meteor.Error(404, 'Blueprint not of type SYSTEM')

		CoreSystem.update(SYSTEM_ID, {
			$set: {
				blueprintId: blueprintId
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

class ServerBlueprintAPI extends MethodContextAPI implements NewBlueprintAPI {
	insertBlueprint () {
		return makePromise(() => insertBlueprint(this))
	}
	removeBlueprint (blueprintId: BlueprintId) {
		return makePromise(() => removeBlueprint(this, blueprintId))
	}
	assignSystemBlueprint (blueprintId?: BlueprintId) {
		return makePromise(() => assignSystemBlueprint(this, blueprintId))
	}
}
registerClassToMeteorMethods(BlueprintAPIMethods, ServerBlueprintAPI, false)
