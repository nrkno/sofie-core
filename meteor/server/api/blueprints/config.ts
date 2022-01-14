import * as _ from 'underscore'
import { ConfigItemValue, ConfigManifestEntry, IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { Studios, StudioId } from '../../../lib/collections/Studios'
import { Meteor } from 'meteor/meteor'
import { ShowStyleVariantId } from '../../../lib/collections/ShowStyleVariants'
import { protectString, objectPathGet } from '../../../lib/lib'
import { ReadonlyDeep } from 'type-fest'
import { getShowStyleCompound } from '../showStyles'

/**
 * This whole ConfigRef logic will need revisiting for a multi-studio context, to ensure that there are strict boundaries across who can give to access to what.
 * Especially relevant for multi-user.
 */
export namespace ConfigRef {
	export async function retrieveRefs(
		stringWithReferences: string,
		modifier?: (str: string) => string,
		bailOnError?: boolean
	): Promise<string> {
		if (!stringWithReferences) return stringWithReferences

		const refs = stringWithReferences.match(/\$\{[^}]+\}/g) || []
		for (const ref of refs) {
			if (ref) {
				let value = (await retrieveRef(ref, bailOnError)) + ''
				if (value) {
					if (modifier) value = modifier(value)
					stringWithReferences = stringWithReferences.replace(ref, value)
				}
			}
		}
		return stringWithReferences
	}
	async function retrieveRef(
		reference: string,
		bailOnError?: boolean
	): Promise<ConfigItemValue | string | undefined> {
		if (!reference) return undefined
		const m = reference.match(/\$\{([^.}]+)\.([^.}]+)\.([^.}]+)\}/)
		if (m) {
			if (m[1] === 'studio' && _.isString(m[2]) && _.isString(m[3])) {
				const studioId: StudioId = protectString(m[2])
				const configId = m[3]
				const studio = await Studios.findOneAsync(studioId)
				if (studio) {
					return objectPathGet(studio.blueprintConfig, configId)
				} else if (bailOnError)
					throw new Meteor.Error(404, `Ref "${reference}": Studio "${studioId}" not found`)
			} else if (m[1] === 'showStyle' && _.isString(m[2]) && _.isString(m[3])) {
				const showStyleVariantId = protectString<ShowStyleVariantId>(m[2])
				const configId = m[3]
				const showStyleCompound = await getShowStyleCompound(showStyleVariantId)
				if (showStyleCompound) {
					return objectPathGet(showStyleCompound.blueprintConfig, configId)
				} else if (bailOnError)
					throw new Meteor.Error(
						404,
						`Ref "${reference}": Showstyle variant "${showStyleVariantId}" not found`
					)
			}
		}
		return undefined
	}
}

export function findMissingConfigs(
	manifest: ConfigManifestEntry[] | undefined,
	config: ReadonlyDeep<IBlueprintConfig>
) {
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
