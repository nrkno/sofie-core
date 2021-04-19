import * as _ from 'underscore'
import path from 'path'
import { promises as fsPromise } from 'fs'
import { getCurrentTime, protectString, unprotectString, getRandomId, makePromise } from '../../../lib/lib'
import { logger } from '../../logging'
import { Meteor } from 'meteor/meteor'
import { Blueprints, Blueprint, BlueprintId } from '../../../lib/collections/Blueprints'
import {
	BlueprintManifestType,
	SomeBlueprintManifest,
	TranslationsBundle,
} from '@sofie-automation/blueprints-integration'
import { check, Match } from '../../../lib/check'
import { NewBlueprintAPI, BlueprintAPIMethods } from '../../../lib/api/blueprint'
import { registerClassToMeteorMethods } from '../../methods'
import { parseVersion, parseRange, CoreSystem, SYSTEM_ID, getCoreSystem } from '../../../lib/collections/CoreSystem'
import { evalBlueprint } from './cache'
import { removeSystemStatus } from '../../systemStatus/systemStatus'
import { MethodContext, MethodContextAPI } from '../../../lib/api/methods'
import { OrganizationContentWriteAccess, OrganizationReadAccess } from '../../security/organization'
import { SystemWriteAccess } from '../../security/system'
import { OrganizationId } from '../../../lib/collections/Organization'
import { Credentials, isResolvedCredentials } from '../../security/lib/credentials'
import { Settings } from '../../../lib/Settings'
import { upsertBundles } from '../translationsBundles'
import { fsMakeDir, fsReadFile, fsWriteFile } from '../../lib'

export function insertBlueprint(
	methodContext: MethodContext,
	type?: BlueprintManifestType,
	name?: string
): BlueprintId {
	const { organizationId, cred } = OrganizationContentWriteAccess.blueprint(methodContext)
	if (Settings.enableUserAccounts && isResolvedCredentials(cred)) {
		if (!cred.user || !cred.user.superAdmin) {
			throw new Meteor.Error(401, 'Only super admins can create new blueprints')
		}
	}
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
			showStyle: {},
		},

		blueprintVersion: '',
		integrationVersion: '',
		TSRVersion: '',
	})
}
export function removeBlueprint(methodContext: MethodContext, blueprintId: BlueprintId) {
	check(blueprintId, String)
	OrganizationContentWriteAccess.blueprint(methodContext, blueprintId, true)
	if (!blueprintId) throw new Meteor.Error(404, `Blueprint id "${blueprintId}" was not found`)

	Blueprints.remove(blueprintId)
	removeSystemStatus('blueprintCompability_' + blueprintId)
}

export function uploadBlueprint(
	context: Credentials,
	blueprintId: BlueprintId,
	body: string,
	blueprintName?: string,
	ignoreIdChange?: boolean
): Blueprint {
	check(blueprintId, String)
	check(body, String)
	check(blueprintName, Match.Maybe(String))

	// TODO: add access control here
	const { organizationId } = OrganizationContentWriteAccess.blueprint(context, blueprintId, true)
	if (!Meteor.isTest) logger.info(`Got blueprint '${blueprintId}'. ${body.length} bytes`)

	if (!blueprintId) throw new Meteor.Error(400, `Blueprint id "${blueprintId}" is not valid`)
	const blueprint = Blueprints.findOne(blueprintId)

	return innerUploadBlueprint(organizationId, blueprint, blueprintId, body, blueprintName, ignoreIdChange)
}
export function uploadBlueprintAsset(_context: Credentials, fileId: string, body: string) {
	check(fileId, String)
	check(body, String)

	let system = getCoreSystem()
	if (!system) throw new Meteor.Error(500, `CoreSystem not found!`)
	if (!system.storePath) throw new Meteor.Error(500, `CoreSystem.storePath not set!`)

	// TODO: add access control here
	const data = Buffer.from(body, 'base64')
	const parsedPath = path.parse(fileId)
	logger.info(
		`Write ${data.length} bytes to ${path.join(system.storePath, fileId)} (storePath: ${
			system.storePath
		}, fileId: ${fileId})`
	)
	fsMakeDir(path.join(system.storePath, parsedPath.dir), { recursive: true })
	fsWriteFile(path.join(system.storePath, fileId), data)
}
export function retrieveBlueprintAsset(_context: Credentials, fileId: string) {
	check(fileId, String)

	let system = getCoreSystem()
	if (!system) throw new Meteor.Error(500, `CoreSystem not found!`)
	if (!system.storePath) throw new Meteor.Error(500, `CoreSystem.storePath not set!`)

	// TODO: add access control here
	return fsReadFile(path.join(system.storePath, fileId))
}
/** Only to be called from internal functions */
export function internalUploadBlueprint(
	blueprintId: BlueprintId,
	body: string,
	blueprintName?: string,
	ignoreIdChange?: boolean
): Blueprint {
	const organizationId = null
	const blueprint = Blueprints.findOne(blueprintId)

	return innerUploadBlueprint(organizationId, blueprint, blueprintId, body, blueprintName, ignoreIdChange)
}
export function innerUploadBlueprint(
	organizationId: OrganizationId | null,
	blueprint: Blueprint | undefined,
	blueprintId: BlueprintId,
	body: string,
	blueprintName?: string,
	ignoreIdChange?: boolean
): Blueprint {
	const newBlueprint: Blueprint = {
		_id: blueprintId,
		organizationId: organizationId,
		name: blueprint ? blueprint.name : blueprintName || unprotectString(blueprintId),
		created: blueprint ? blueprint.created : getCurrentTime(),
		code: body,
		modified: getCurrentTime(),
		studioConfigManifest: [],
		showStyleConfigManifest: [],
		databaseVersion: blueprint
			? blueprint.databaseVersion
			: {
					studio: {},
					showStyle: {},
			  },
		blueprintId: protectString(''),
		blueprintVersion: '',
		integrationVersion: '',
		TSRVersion: '',
		blueprintType: undefined,
	}

	let blueprintManifest: SomeBlueprintManifest | undefined
	try {
		blueprintManifest = evalBlueprint(newBlueprint)
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

	if (blueprint && blueprint.blueprintType && blueprint.blueprintType !== newBlueprint.blueprintType) {
		throw new Meteor.Error(
			400,
			`Cannot replace old blueprint (of type "${blueprint.blueprintType}") with new blueprint of type "${newBlueprint.blueprintType}"`
		)
	}
	if (blueprint && blueprint.blueprintId && blueprint.blueprintId !== newBlueprint.blueprintId) {
		if (ignoreIdChange) {
			logger.warn(
				`Replacing blueprint "${newBlueprint._id}" ("${blueprint.blueprintId}") with new blueprint "${newBlueprint.blueprintId}"`
			)

			// Force reset migrations
			newBlueprint.databaseVersion = {
				showStyle: {},
				studio: {},
			}
		} else {
			throw new Meteor.Error(
				422,
				`Cannot replace old blueprint "${newBlueprint._id}" ("${blueprint.blueprintId}") with new blueprint "${newBlueprint.blueprintId}"`
			)
		}
	}

	if (blueprintManifest.blueprintType === BlueprintManifestType.SHOWSTYLE) {
		newBlueprint.showStyleConfigManifest = blueprintManifest.showStyleConfigManifest
	}
	if (blueprintManifest.blueprintType === BlueprintManifestType.STUDIO) {
		newBlueprint.studioConfigManifest = blueprintManifest.studioConfigManifest
	}

	// check for translations on the manifest and store them if they exist
	if (
		'translations' in blueprintManifest &&
		(blueprintManifest.blueprintType === BlueprintManifestType.SHOWSTYLE ||
			blueprintManifest.blueprintType === BlueprintManifestType.STUDIO)
	) {
		// Because the translations is bundled as stringified JSON and that string has already been
		// converted back to object form together with the rest of the manifest at this point
		// the casting is actually necessary.
		// Note that the type has to be string in the manifest interfaces to allow attaching the
		// stringified JSON in the first place.
		const translations = (blueprintManifest as any).translations as TranslationsBundle[]
		upsertBundles(translations, blueprintId)
	}

	// Parse the versions, just to verify that the format is correct:
	parseVersion(blueprintManifest.blueprintVersion)
	parseVersion(blueprintManifest.integrationVersion)
	parseVersion(blueprintManifest.TSRVersion)

	Blueprints.upsert(newBlueprint._id, newBlueprint)
	return newBlueprint
}

function assignSystemBlueprint(methodContext: MethodContext, blueprintId?: BlueprintId) {
	SystemWriteAccess.coreSystem(methodContext)

	if (blueprintId !== undefined && blueprintId !== null) {
		check(blueprintId, String)

		const blueprint = Blueprints.findOne(blueprintId)
		if (!blueprint) throw new Meteor.Error(404, 'Blueprint not found')

		if (blueprint.organizationId)
			OrganizationReadAccess.organizationContent(
				{ organizationId: blueprint.organizationId },
				{ userId: methodContext.userId }
			)

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

class ServerBlueprintAPI extends MethodContextAPI implements NewBlueprintAPI {
	insertBlueprint() {
		return makePromise(() => insertBlueprint(this))
	}
	removeBlueprint(blueprintId: BlueprintId) {
		return makePromise(() => removeBlueprint(this, blueprintId))
	}
	assignSystemBlueprint(blueprintId?: BlueprintId) {
		return makePromise(() => assignSystemBlueprint(this, blueprintId))
	}
}
registerClassToMeteorMethods(BlueprintAPIMethods, ServerBlueprintAPI, false)
