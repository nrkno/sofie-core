import { BlueprintManifestType, SomeBlueprintManifest } from 'tv-automation-sofie-blueprints-integration'
import { literal, protectString } from '../../../../lib/lib'
import { Blueprint } from '../../../../lib/collections/Blueprints'

export function generateFakeBlueprint(id: string, type?: BlueprintManifestType, codeFcn?: () => SomeBlueprintManifest) {
	let codeFcnString = ''
	if (!codeFcn) {
		codeFcn = () => ({
			blueprintType: (18321 as any) as BlueprintManifestType.SYSTEM, // magic number, to be replaced later
			blueprintVersion: '0.0.0',
			integrationVersion: '0.0.0',
			TSRVersion: '0.0.0',
			minimumCoreVersion: '0.0.0',

			studioConfigManifest: [],
			studioMigrations: [],
			getBaseline: () => [],
			getShowStyleId: () => null,
		})
		codeFcnString = codeFcn && codeFcn.toString()
		codeFcnString = codeFcnString.replace(/18321/, type ? `"${type}"` : 'undefined')
	} else {
		codeFcnString = codeFcn && codeFcn.toString()
	}
	return literal<Blueprint>({
		_id: protectString(id),
		name: 'Fake blueprint',
		organizationId: null,
		code: `({default: (${codeFcnString || '() => 5'})()})`,
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
