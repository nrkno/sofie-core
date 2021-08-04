import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	ShowStyleBlueprintManifest,
	SomeBlueprintManifest,
	StudioBlueprintManifest,
	SystemBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { VM } from 'vm2'
import { IDirectCollections } from '../db'

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

export async function loadBlueprintById(
	collections: IDirectCollections,
	blueprintId: BlueprintId
): Promise<SomeBlueprintManifest | undefined> {
	const blueprint = await collections.Blueprints.findOne(blueprintId)
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

export function evalBlueprint(blueprint: Blueprint): SomeBlueprintManifest {
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

	return manifest
}
