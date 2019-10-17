import * as _ from 'underscore'
import { getCurrentTime } from '../../../lib/lib'
import { logger } from '../../logging'
import { Meteor } from 'meteor/meteor'
import { Blueprints, Blueprint } from '../../../lib/collections/Blueprints'
import {
	BlueprintManifestType,
	SomeBlueprintManifest,
	BlueprintManifestSet,
} from 'tv-automation-sofie-blueprints-integration'
import { ServerResponse, IncomingMessage } from 'http'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import * as bodyParser from 'body-parser'
import { Random } from 'meteor/random'
import { check, Match } from 'meteor/check'
import { parse as parseUrl } from 'url'
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
	Blueprints.remove(id)
	removeSystemStatus('blueprintCompability_' + id)
}

export function uploadBlueprint (blueprintId: string, body: string, blueprintName: string): Blueprint {
	logger.info(`Got blueprint '${blueprintId}'. ${body.length} bytes`)

	const blueprint = Blueprints.findOne(blueprintId)

	const newBlueprint: Blueprint = {
		_id: blueprintId,
		name: blueprint ? blueprint.name : (blueprintName || blueprintId),
		created: blueprint ? blueprint.created : getCurrentTime(),
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

	const blueprintManifest: SomeBlueprintManifest = evalBlueprints(newBlueprint, false)
	if (!blueprintManifest) throw new Meteor.Error(400, `Blueprint ${blueprintId} did not return a manifest`)
	if (!_.isObject(blueprintManifest)) throw new Meteor.Error(400, `Blueprint ${blueprintId} retured a manifest of type ${typeof blueprintManifest}`)

	newBlueprint.blueprintType				= blueprintManifest.blueprintType || BlueprintManifestType.SHOWSTYLE
	newBlueprint.blueprintVersion			= blueprintManifest.blueprintVersion
	newBlueprint.integrationVersion			= blueprintManifest.integrationVersion
	newBlueprint.TSRVersion					= blueprintManifest.TSRVersion
	newBlueprint.minimumCoreVersion			= blueprintManifest.minimumCoreVersion

	if (
		blueprint &&
		blueprint.blueprintType &&
		newBlueprint.blueprintType &&
		blueprint.blueprintType !== newBlueprint.blueprintType
	) {
		throw new Meteor.Error(400, `Cannot replace old blueprint (of type "${blueprint.blueprintType}") with new blueprint of type "${newBlueprint.blueprintType}"`)
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

	const existing = Blueprints.findOne(newBlueprint._id)
	if (existing && existing.blueprintType && existing.blueprintType !== newBlueprint.blueprintType) {
		throw new Meteor.Error(500, 'Restore blueprint: Cannot replace blueprint with a different type')
	}

	Blueprints.upsert(newBlueprint._id, newBlueprint)
	return newBlueprint
}

const postJsRoute = Picker.filter((req, res) => req.method === 'POST')
postJsRoute.middleware(bodyParser.text({
	type: 'text/javascript',
	limit: '1mb'
}))
postJsRoute.route('/blueprints/restore/:blueprintId', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	let blueprintId = params.blueprintId
	let url = parseUrl(req.url || '', true)

	let blueprintNames = url.query['name'] || undefined
	let blueprintName: string = (
		_.isArray(blueprintNames) ?
		blueprintNames[0] :
		blueprintNames
	) || ''

	check(blueprintId, String)
	check(blueprintName, Match.Maybe(String))

	let content = ''
	try {
		const body = (req as any).body
		if (!body) throw new Meteor.Error(400, 'Restore Blueprint: Missing request body')

		if (typeof body !== 'string' || body.length < 10) throw new Meteor.Error(400, 'Restore Blueprint: Invalid request body')

		uploadBlueprint(blueprintId, body, blueprintName)

		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.error('Blueprint restore failed: ' + e)
	}

	res.end(content)
})
const postJsonRoute = Picker.filter((req, res) => req.method === 'POST')
postJsonRoute.middleware(bodyParser.text({
	type: 'application/json',
	limit: '10mb'
}))
postJsonRoute.route('/blueprints/restore', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	let content = ''
	try {
		const body = (req as any).body
		if (!body) throw new Meteor.Error(400, 'Restore Blueprint: Missing request body')

		let collection = body
		if (_.isString(body)) {
			if (body.length < 10) throw new Meteor.Error(400, 'Restore Blueprint: Invalid request body')
			collection = JSON.parse(body) as BlueprintManifestSet
		} else if (!_.isObject(body)) {
			throw new Meteor.Error(400, 'Restore Blueprint: Invalid request body')
		}

		logger.info(`Got blueprint collection. ${Object.keys(body).length} blueprints`)

		let errors: any[] = []
		for (const id of _.keys(collection)) {
			try {
				uploadBlueprint(id, collection[id], id)
			} catch (e) {
				logger.error('Blueprint restore failed: ' + e)
				errors.push(e)
			}
		}

		// Report errors
		if (errors.length > 0) {
			res.statusCode = 500
			content += 'Errors were encountered: \n'
			for (const e of errors) {
				content += e + '\n'
			}
		} else {
			res.statusCode = 200
		}

	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.error('Blueprint restore failed: ' + e)
	}

	res.end(content)
})

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
