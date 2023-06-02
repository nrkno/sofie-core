import { TFunction } from 'react-i18next'
import { GUISettings, GUISettingsType, guiSettingId } from '../guiSettings'
import { Studio } from '../../../../lib/collections/Studios'
import { genericProperties } from './generic'
import { devicesProperties } from './devices'
import { blueprintProperties } from './blueprint'
import { layerMappingsProperties } from './layerMappings'

export function generateStudioSettings(t: TFunction, studio: Studio): GUISettings {
	const settings: GUISettings = { list: [] }

	{
		settings.list.push({
			type: GUISettingsType.SECTION,
			name: 'Generic Properties',
			id: guiSettingId('generic'),

			getList: () => genericProperties({ t, studio, urlBase: 'generic' }),
			getSearchString: '',
			renderSummary: () => null,
		})
	}

	settings.list.push({
		type: GUISettingsType.SECTION,
		name: 'Devices',
		id: guiSettingId('devices'),

		getList: () => devicesProperties({ t, studio, urlBase: 'devices' }),
		getSearchString: '',
		renderSummary: () => null,
	})

	settings.list.push({
		type: GUISettingsType.SECTION,
		name: 'Blueprint Configuration',
		id: guiSettingId('blueprint'),

		getList: () => blueprintProperties({ t, studio, urlBase: 'blueprint' }),
		getSearchString: '',
		renderSummary: () => null,
		// renderSummary?: () => JSX.Element
	})

	settings.list.push({
		type: GUISettingsType.SECTION,
		name: 'Layer mappings',
		id: guiSettingId('mappings'),

		getList: () => layerMappingsProperties({ t, studio, urlBase: 'mappings' }),
		getSearchString: '',
		renderSummary: () => null,
		// renderSummary?: () => JSX.Element
	})

	// settings.list.push({
	// 	type: GUISettingsType.SECTION,
	// 	name: 'Layer mappings',

	// 	getList: () => (GUISetting<any> | GUISettingSection)[]
	// 	// renderSummary?: () => JSX.Element
	// })
	// settings.list.push({
	// 	type: GUISettingsType.SECTION,
	// 	name: 'Route sets',

	// 	getList: () => (GUISetting<any> | GUISettingSection)[]
	// 	// renderSummary?: () => JSX.Element
	// })

	// settings.list.push({
	// 	type: GUISettingsType.SECTION,
	// 	name: 'Package Manager',

	// 	getList: () => (GUISetting<any> | GUISettingSection)[]
	// 	// renderSummary?: () => JSX.Element
	// })

	return settings
}
