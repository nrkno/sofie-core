import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	ShowStyleBlueprintManifest,
	SomeBlueprintManifest,
	StudioBlueprintManifest,
	SystemBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { VM } from 'vm2'
import { JobContext } from '../jobs'

export const BLUEPRINT_CACHE_CONTROL = { disable: false }

export interface WrappedSystemBlueprint {
	blueprintId: BlueprintId
	blueprint: SystemBlueprintManifest
}
export interface WrappedStudioBlueprint {
	blueprintId: BlueprintId
	blueprint: StudioBlueprintManifest
}
export interface WrappedShowStyleBlueprint {
	blueprintId: BlueprintId
	blueprint: ShowStyleBlueprintManifest
}

// export async function loadSystemBlueprints(system: ICoreSystem): Promise<WrappedSystemBlueprint | undefined> {
// 	if (!system.blueprintId) return undefined

// 	const blueprintManifest = await loadBlueprintById(system.blueprintId)
// 	if (!blueprintManifest) throw new Error(`Blueprint "${system.blueprintId}" not found! (referenced by CoreSystem)`)

// 	if (blueprintManifest.blueprintType !== BlueprintManifestType.SYSTEM) {
// 		throw new Error(
// 			`Blueprint "${system.blueprintId}" is not valid for a CoreSystem (${blueprintManifest.blueprintType})!`
// 		)
// 	}

// 	return {
// 		blueprintId: system.blueprintId,
// 		blueprint: blueprintManifest,
// 	}
// }

// export async function loadStudioBlueprint(studio: ReadonlyDeep<DBStudio>): Promise<WrappedStudioBlueprint | undefined> {
// 	if (!studio.blueprintId) return undefined

// 	const blueprintManifest = await loadBlueprintById(studio.blueprintId)
// 	if (!blueprintManifest) {
// 		throw new Meteor.Error(
// 			404,
// 			`Blueprint "${studio.blueprintId}" not found! (referenced by Studio "${studio._id}")`
// 		)
// 	}

// 	if (blueprintManifest.blueprintType !== BlueprintManifestType.STUDIO) {
// 		throw new Meteor.Error(
// 			500,
// 			`Blueprint "${studio.blueprintId}" is not valid for a Studio "${studio._id}" (${blueprintManifest.blueprintType})!`
// 		)
// 	}

// 	return {
// 		blueprintId: studio.blueprintId,
// 		blueprint: blueprintManifest,
// 	}
// }

// export async function loadShowStyleBlueprint(
// 	context: JobContext,
// 	showStyleBase: ReadonlyDeep<DBShowStyleBase>
// ): Promise<WrappedShowStyleBlueprint> {
// 	if (!showStyleBase.blueprintId) {
// 		throw new Error(`ShowStyleBase "${showStyleBase._id}" has no defined blueprint!`)
// 	}

// 	const blueprintManifest = await loadBlueprintById(context, showStyleBase.blueprintId)
// 	if (!blueprintManifest) {
// 		throw new Error(
// 			`Blueprint "${showStyleBase.blueprintId}" not found! (referenced by ShowStyleBase "${showStyleBase._id}")`
// 		)
// 	}

// 	if (blueprintManifest.blueprintType !== BlueprintManifestType.SHOWSTYLE) {
// 		throw new Error(
// 			`Blueprint "${showStyleBase.blueprintId}" is not valid for a ShowStyle "${showStyleBase._id}" (${blueprintManifest.blueprintType})!`
// 		)
// 	}

// 	return {
// 		blueprintId: showStyleBase.blueprintId,
// 		blueprint: blueprintManifest,
// 	}
// }

const blueprintDocCache: { [blueprintId: string]: Blueprint } = {}
export async function loadBlueprintById(
	context: JobContext,
	blueprintId: BlueprintId
): Promise<SomeBlueprintManifest | undefined> {
	let blueprint: Blueprint | undefined = blueprintDocCache[unprotectString(blueprintId)]
	if (!blueprint || BLUEPRINT_CACHE_CONTROL.disable) {
		blueprint = await context.directCollections.Blueprints.findOne(blueprintId)

		if (blueprint && !BLUEPRINT_CACHE_CONTROL.disable) blueprintDocCache[unprotectString(blueprintId)] = blueprint
	}

	if (!blueprint) return undefined
	if (blueprint.code) {
		let manifest: SomeBlueprintManifest
		try {
			manifest = evalBlueprint(blueprint)
		} catch (e) {
			throw new Error('Syntax error in blueprint "' + blueprint._id + '": ' + e.toString())
		}
		if (manifest.blueprintType !== blueprint.blueprintType) {
			throw new Error(
				`Evaluated Blueprint-manifest and document does not have the same blueprintType ("${manifest.blueprintType}", "${blueprint.blueprintType}")!`
			)
		}
		return manifest
	} else {
		throw new Error(`Blueprint "${blueprint._id}".code not set!`)
	}
}

const blueprintManifestCache: { [blueprintId: string]: BlueprintManifestCache } = {}
interface BlueprintManifestCache {
	modified: number
	manifest: SomeBlueprintManifest
}
export function evalBlueprint(blueprint: Blueprint): SomeBlueprintManifest {
	let cached: BlueprintManifestCache | null = null
	if (!BLUEPRINT_CACHE_CONTROL.disable) {
		// First, check if we've got the manifest cached:
		cached = blueprintManifestCache[unprotectString(blueprint._id)]
			? blueprintManifestCache[unprotectString(blueprint._id)]
			: null
		if (cached && (!cached.modified || cached.modified !== blueprint.modified)) {
			// the function has been updated, invalidate it then:
			cached = null
		}
	}

	if (cached) {
		return cached.manifest
	} else {
		const vm = new VM({
			sandbox: {
				// _,
				// moment,
			},
		})

		const entry = vm.run(blueprint.code, `db/blueprint/${blueprint.name || blueprint._id}.js`)
		const manifest: SomeBlueprintManifest = entry.default

		// // Wrap the functions, to emit better errors
		// _.each(_.keys(manifest), (key) => {
		// 	const value = manifest[key]
		// 	if (_.isFunction(value)) {
		// 		manifest[key] = (...args: any[]) => {
		// 			try {
		// 				return value(...args)
		// 			} catch (e) {
		// 				let msg = `Error in Blueprint "${blueprint._id}".${key}: "${e.toString()}"`
		// 				if (e.stack) msg += '\n' + e.stack
		// 				logger.error(msg)
		// 				throw e
		// 			}
		// 		}
		// 	}
		// })

		blueprintManifestCache[unprotectString(blueprint._id)] = {
			manifest,
			modified: blueprint.modified,
		}
		return manifest
	}
}

// Meteor.startup(() => {
// 	if (Meteor.isServer) {
// 		const triggerBlueprintChanged = (id) => {
// 			delete blueprintManifestCache[unprotectString(id)]
// 			delete blueprintDocCache[unprotectString(id)]
// 		}
// 		Blueprints.find({}).observeChanges({
// 			added: (id: BlueprintId) => {
// 				triggerBlueprintChanged(id)
// 			},
// 			changed: (id: BlueprintId) => {
// 				triggerBlueprintChanged(id)
// 			},
// 			removed: (id: BlueprintId) => {
// 				triggerBlueprintChanged(id)
// 			},
// 		})
// 	}
// })
