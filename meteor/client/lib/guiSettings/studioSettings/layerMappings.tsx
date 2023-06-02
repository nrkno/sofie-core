import React, { useCallback, useMemo } from 'react'
import { TFunction } from 'react-i18next'
import {
	GUISetting,
	GUISettingSection,
	GUISettingSectionList,
	GUISettingsType,
	guiSetting,
	guiSettingId,
} from '../guiSettings'
import { MappingExt, Studio, getActiveRoutes } from '../../../../lib/collections/Studios'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { TSR, LookaheadMode, JSONBlob, JSONBlobParse, JSONSchema } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	applyAndValidateOverrides,
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { PeripheralDevices, Studios } from '../../../collections'
import { PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { useTracker } from '../../ReactMeteorData/ReactMeteorData'
import { SubdeviceManifest } from '@sofie-automation/corelib/dist/deviceConfig'
import { MappingsSettingsManifests, MappingsSettingsManifest } from '../../../ui/Settings/Studio/Mappings'
import { translateStringIfHasNamespaces } from '../../forms/schemaFormUtil'
import {
	getAllCurrentAndDeletedItemsFromOverrides,
	useOverrideOpHelper,
} from '../../../ui/Settings/util/OverrideOpHelper'

export function layerMappingsProperties(props: {
	t: TFunction
	studio: Studio
	urlBase: string
}): GUISettingSectionList {
	const { t, studio, urlBase } = props
	const settings: (GUISetting<any> | GUISettingSection)[] = []

	let warning: GUISettingSectionList['warning'] = undefined

	const firstPlayoutDevice = useTracker(
		() =>
			PeripheralDevices.findOne(
				{
					studioId: {
						$eq: studio._id,
					},
					parentDeviceId: {
						$exists: false,
					},
					type: {
						$eq: PeripheralDeviceType.PLAYOUT,
					},
				},
				{
					sort: {
						lastConnected: -1,
					},
				}
			),

		[studio._id]
	)

	const { translationNamespaces, layerMappingsSchema } = useMemo(() => {
		const translationNamespaces = [`peripheralDevice_${firstPlayoutDevice?._id}`]
		const layerMappingsSchema: MappingsSettingsManifests = Object.fromEntries(
			Object.entries<SubdeviceManifest[0]>(firstPlayoutDevice?.configManifest?.subdeviceManifest || {}).map(
				([id, val]) => {
					const mappingsSchema = val.playoutMappings
						? Object.fromEntries(
								Object.entries<JSONBlob<JSONSchema>>(val.playoutMappings).map(([id, schema]) => [
									id,
									JSONBlobParse(schema),
								])
						  )
						: undefined

					return [
						id,
						literal<MappingsSettingsManifest>({
							displayName: translateStringIfHasNamespaces(val.displayName, translationNamespaces),
							mappingsSchema,
						}),
					]
				}
			)
		)

		return { translationNamespaces, layerMappingsSchema }
	}, [firstPlayoutDevice])

	if (!layerMappingsSchema) {
		warning = t('Add a playout device to the studio in order to edit the layer mappings')
	}

	const activeRoutes = useMemo(() => getActiveRoutes(studio.routeSets), [studio.routeSets])

	const sortedMappings = useMemo(
		() => getAllCurrentAndDeletedItemsFromOverrides(studio.mappingsWithOverrides, (a, b) => a[0].localeCompare(b[0])),
		[studio.mappingsWithOverrides]
	)

	const saveOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					'mappingsWithOverrides.overrides': newOps,
				},
			})
		},
		[studio._id]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, studio.mappingsWithOverrides)

	for (const item of sortedMappings) {
		if (item.type === 'deleted') {
			// TODO
		} else {
			settings.push(
				guiSetting({
					type: GUISettingsType.SETTING,
					name: item.computed.layerName || item.id,
					description: '',
					id: guiSettingId(urlBase, item.id),
					getWarning: () => undefined,
					render: (renderProps: { t: TFunction; studio: Studio }) => {
						return <></>
					},
					renderProps: { t, studio: studio },
					getSearchString: '',
				})
			)
		}
	}
	// Finally:
	settings.push(getSettingAddNewLayer({ t, studio, urlBase }))

	return { warning, list: settings }
}

const getSettingAddNewLayer = (props: { t: TFunction; studio: Studio; urlBase: string }) => {
	const { t, studio, urlBase } = props

	return guiSetting({
		type: GUISettingsType.SETTING,
		name: t('Add Mapping'),
		description: t('Add a Layer Mapping to the studio'),
		id: guiSettingId(urlBase, 'add-device'),
		getWarning: () => undefined,
		render: (renderProps: { t: TFunction; studio: Studio }) => {
			const addNewLayer = useCallback(() => {
				const resolvedMappings = applyAndValidateOverrides(renderProps.studio.mappingsWithOverrides).obj

				// find free key name
				const newLayerKeyName = 'newLayer'
				let iter = 0
				while (resolvedMappings[newLayerKeyName + iter.toString()]) {
					iter++
				}

				const newId = newLayerKeyName + iter.toString()
				const newMapping = literal<MappingExt>({
					device: TSR.DeviceType.CASPARCG,
					deviceId: protectString('newDeviceId'),
					lookahead: LookaheadMode.NONE,
					options: {},
				})

				const addOp = literal<ObjectOverrideSetOp>({
					op: 'set',
					path: newId,
					value: newMapping,
				})

				Studios.update(renderProps.studio._id, {
					$push: {
						'mappingsWithOverrides.overrides': addOp,
					},
				})

				// setImmediate(() => {
				// 	toggleExpanded(newId, true)
				// })
			}, [renderProps.studio._id, renderProps.studio.mappingsWithOverrides])

			return (
				<button className="btn btn-primary" onClick={addNewLayer}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			)
		},
		renderProps: { t, studio: studio },
		getSearchString: '',
	})
}
