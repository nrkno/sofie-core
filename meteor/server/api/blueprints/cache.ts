import * as _ from 'underscore'
import { VM } from 'vm2'
import { logger } from '../../logging'
import { Blueprint } from '../../../lib/collections/Blueprints'
import { SomeBlueprintManifest } from '@sofie-automation/blueprints-integration'
import { stringifyError } from '@sofie-automation/corelib/dist/lib'
import { Meteor } from 'meteor/meteor'

export function evalBlueprint(blueprint: Blueprint): SomeBlueprintManifest {
	const vm = new VM({
		sandbox: {},
	})

	const entry = vm.run(blueprint.code, `db/blueprint/${blueprint.name || blueprint._id}.js`)
	const manifest: SomeBlueprintManifest = entry.default

	// Wrap the functions, to emit better errors
	_.each(_.keys(manifest), (key) => {
		const value = manifest[key]
		if (_.isFunction(value)) {
			manifest[key] = (...args: any[]) => {
				try {
					return value(...args)
				} catch (e) {
					let msg = `Error in Blueprint "${blueprint._id}".${key}: "${stringifyError(e)}"`
					if ((e instanceof Error || e instanceof Meteor.Error) && e.stack) msg += '\n' + e.stack
					logger.error(msg)
					throw e
				}
			}
		}
	})

	return manifest
}
