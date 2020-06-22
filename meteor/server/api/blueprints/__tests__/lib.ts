import { BlueprintManifestType, SomeBlueprintManifest } from 'tv-automation-sofie-blueprints-integration'
import { literal, protectString } from '../../../../lib/lib'
import { Blueprint } from '../../../../lib/collections/Blueprints'

export function generateFakeBlueprint(id: string, type?: BlueprintManifestType, codeFcn?: () => SomeBlueprintManifest) {
	return literal<Blueprint>({
		_id: protectString(id),
		name: 'Fake blueprint',
		organizationId: null,
		code: `({default: (${(codeFcn && codeFcn.toString()) || '() => 5'})()})`,
		created: 0,
		modified: 0,

		blueprintId: protectString(''),
		blueprintType: type,

		studioConfigManifest: [],
		showStyleConfigManifest: [],

		databaseVersion: {
			showStyle: {},
			studio: {},
		},

		blueprintVersion: '',
		integrationVersion: '',
		TSRVersion: '',
		minimumCoreVersion: '',
	})
}
