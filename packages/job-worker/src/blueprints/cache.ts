import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	ShowStyleBlueprintManifest,
	SomeBlueprintManifest,
	StudioBlueprintManifest,
	SystemBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { VM } from 'vm2'
import { IDirectCollections } from '../db'
import { ReadonlyDeep } from 'type-fest'
import { stringifyError } from '@sofie-automation/corelib/dist/lib'
// import { deepFreeze } from '@sofie-automation/corelib/dist/lib'

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
): Promise<ReadonlyDeep<SomeBlueprintManifest> | undefined> {
	const blueprint = await collections.Blueprints.findOne(blueprintId)
	if (!blueprint) return undefined

	if (blueprint.code) {
		let manifest: SomeBlueprintManifest
		try {
			const vm = new VM({
				sandbox: {},
			})

			// Future: we should look at freezing the object inside the vm
			const entry = vm.run(
				'__run_result = ' + blueprint.code + '; __run_result || blueprint',
				`db/blueprint/${blueprint.name || blueprint._id}.js`
			)
			manifest = entry.default
		} catch (e) {
			throw new Error(`Syntax error in blueprint "${blueprint._id}": ${stringifyError(e)}`)
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
