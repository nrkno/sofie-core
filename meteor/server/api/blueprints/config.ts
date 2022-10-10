import * as _ from 'underscore'
import { ConfigManifestEntry, IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { objectPathGet } from '../../../lib/lib'
import { ReadonlyDeep } from 'type-fest'

export function findMissingConfigs(
	manifest: ConfigManifestEntry[] | undefined,
	config: ReadonlyDeep<IBlueprintConfig>
): string[] {
	const missingKeys: string[] = []
	if (manifest === undefined) {
		return missingKeys
	}
	_.each(manifest, (m) => {
		if (m.required && config && objectPathGet(config, m.id) === undefined) {
			missingKeys.push(m.name)
		}
	})

	return missingKeys
}
