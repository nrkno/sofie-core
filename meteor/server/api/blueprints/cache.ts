import * as _ from 'underscore'
import * as moment from 'moment'
import { SaferEval } from 'safer-eval'
import { logger } from '../../logging'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { ShowStyleBase, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { Meteor } from 'meteor/meteor'
import { Blueprints, Blueprint } from '../../../lib/collections/Blueprints'
import {
	BlueprintManifestType,
	SomeBlueprintManifest,
	ShowStyleBlueprintManifest,
	StudioBlueprintManifest,
	SystemBlueprintManifest,
} from 'tv-automation-sofie-blueprints-integration'
import { ICoreSystem } from '../../../lib/collections/CoreSystem'

const blueprintCache: {[id: string]: Cache} = {}
interface Cache {
	modified: number,
	fcn: SomeBlueprintManifest
}

export function loadSystemBlueprints (system: ICoreSystem): SystemBlueprintManifest | undefined {
	if (!system.blueprintId) return undefined

	const blueprint = loadBlueprintsById(system.blueprintId)
	if (!blueprint) throw new Meteor.Error(404, `Blueprint "${system.blueprintId}" not found! (referenced by CoreSystem)`)

	if (blueprint.blueprintType !== BlueprintManifestType.SYSTEM) {
		throw new Meteor.Error(500, `Blueprint "${system.blueprintId}" is not valid for a CoreSystem!`)
	}
	return blueprint
}

export function loadStudioBlueprints (studio: StudioInstallation): StudioBlueprintManifest | undefined {
	if (!studio.blueprintId) return undefined

	const blueprint = loadBlueprintsById(studio.blueprintId)
	if (!blueprint) throw new Meteor.Error(404, `Blueprint "${studio.blueprintId}" not found! (referenced by StudioInstallation "${studio._id}")`)

	if (blueprint.blueprintType !== BlueprintManifestType.STUDIO) {
		throw new Meteor.Error(500, `Blueprint "${studio.blueprintId}" is not valid for a StudioInstallation "${studio._id}"!`)
	}
	return blueprint
}

export function getBlueprintOfRunningOrder (runnningOrder: RunningOrder): ShowStyleBlueprintManifest {
	if (!runnningOrder.showStyleBaseId) throw new Meteor.Error(400, `RunningOrder is missing showStyleBaseId!`)
	let showStyleBase = ShowStyleBases.findOne(runnningOrder.showStyleBaseId)
	if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase "${runnningOrder.showStyleBaseId}" not found!`)
	return loadShowStyleBlueprints(showStyleBase)
}

export function loadShowStyleBlueprints (showStyleBase: ShowStyleBase): ShowStyleBlueprintManifest {
	const blueprint = loadBlueprintsById(showStyleBase.blueprintId)
	if (!blueprint) throw new Meteor.Error(404, `Blueprint "${showStyleBase.blueprintId}" not found! (referenced by ShowStyleBase "${showStyleBase._id}")`)

	if (blueprint.blueprintType !== BlueprintManifestType.SHOWSTYLE) {
		throw new Meteor.Error(500, `Blueprint "${showStyleBase.blueprintId}" is not valid for a ShowStyle "${showStyleBase._id}"!`)
	}
	return blueprint
}

function loadBlueprintsById (id: string): SomeBlueprintManifest | undefined {
	const blueprint = Blueprints.findOne(id)
	if (!blueprint) return undefined

	if (blueprint.code) {
		try {
			return evalBlueprints(blueprint, false)
		} catch (e) {
			throw new Meteor.Error(402, 'Syntax error in blueprint "' + blueprint._id + '": ' + e.toString())
		}
	} else {
		throw new Meteor.Error(500, `Blueprint "${id}" code not set!`)
	}
}
export function evalBlueprints (blueprint: Blueprint, noCache?: boolean): SomeBlueprintManifest {
	let cached: Cache | null = null
	if (!noCache) {
		// First, check if we've got the function cached:
		cached = blueprintCache[blueprint._id] ? blueprintCache[blueprint._id] : null
		if (cached && (!cached.modified || cached.modified !== blueprint.modified)) {
			// the function has been updated, invalidate it then:
			cached = null
		}
	}

	if (cached) {
		return cached.fcn
	} else {
		const context = {
			_,
			moment,
		}

		const entry = new SaferEval(context, { filename: (blueprint.name || blueprint._id) + '.js' }).runInContext(blueprint.code)
		let manifest = entry.default

		// Wrap the functions in manifest, to emit better errors
		_.each(_.keys(manifest), (key) => {
			let value = manifest[key]
			if (_.isFunction(value)) {
				manifest[key] = (...args: any[]) => {
					try {
						return value(...args)
					} catch (e) {
						let msg = `Error in Blueprint "${blueprint._id}".${key}: "${e.toString()}"`
						if (e.stack) msg += '\n' + e.stack
						logger.error(msg)
						throw e
					}
				}
			}
		})

		return manifest
	}
}
