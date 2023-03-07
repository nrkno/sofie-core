import { BlueprintManifestType, SomeBlueprintManifest } from '@sofie-automation/blueprints-integration'
import { getRandomId, literal, protectString } from '../../../../lib/lib'
import { Blueprint } from '../../../../lib/collections/Blueprints'
import { JSONBlobStringify } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'

export function generateFakeBlueprint(
	id: string,
	type?: BlueprintManifestType,
	codeFcn?: () => SomeBlueprintManifest
): Blueprint {
	const codeFcnString = codeFcn
		? codeFcn.toString()
		: `\
() => ({
  blueprintType: ${type ? `"${type}"` : 'undefined'},
  blueprintVersion: '0.0.0',
  integrationVersion: '0.0.0',
  TSRVersion: '0.0.0',
  studioConfigManifest: [],
  studioMigrations: [],
  getBaseline: () => {
	return {
      timelineObjects: [],
    }
  },
  getShowStyleId: () => null
})`

	return literal<Blueprint>({
		_id: protectString(id),
		name: 'Fake blueprint',
		organizationId: null,
		hasCode: true,
		code: `({default: (${codeFcnString})()})`,
		created: 0,
		modified: 0,

		blueprintId: '',
		blueprintType: type,
		blueprintHash: getRandomId(),

		studioConfigSchema: JSONBlobStringify({}),
		showStyleConfigSchema: JSONBlobStringify({}),

		databaseVersion: {
			showStyle: {},
			studio: {},
			system: undefined,
		},

		blueprintVersion: '',
		integrationVersion: '',
		TSRVersion: '',
	})
}
