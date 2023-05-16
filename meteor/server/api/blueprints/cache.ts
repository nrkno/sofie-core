import * as _ from 'underscore'
import { VM, VMScript } from 'vm2'
import { logger } from '../../logging'
import { Blueprint } from '../../../lib/collections/Blueprints'
import { SomeBlueprintManifest } from '@sofie-automation/blueprints-integration'
import { stringifyError } from '@sofie-automation/corelib/dist/lib'

export function evalBlueprint(blueprint: Pick<Blueprint, '_id' | 'name' | 'code'>): SomeBlueprintManifest {
	const vm = new VM({
		sandbox: {},
	})

	const blueprintPath = `db:///blueprint/${blueprint.name || blueprint._id}-bundle.js`
	const script = new VMScript(
		`__run_result = ${blueprint.code}
__run_result || blueprint`,
		blueprintPath
	)
	const entry = vm.run(script)

	const manifest: SomeBlueprintManifest = entry.default

	// Wrap the functions, to emit better errors
	_.each(_.keys(manifest), (key) => {
		const value = manifest[key]
		if (_.isFunction(value)) {
			manifest[key] = (...args: any[]) => {
				try {
					return value(...args)
				} catch (e) {
					logger.error(`Error in Blueprint "${blueprint._id}".${key}: "${stringifyError(e)}"`)
					throw e
				}
			}
		}
	})

	return manifest
}
