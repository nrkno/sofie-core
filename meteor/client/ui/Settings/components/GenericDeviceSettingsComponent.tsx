import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	PeripheralDevice,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '../../../../lib/collections/PeripheralDevices'
import { DeviceItem } from '../../Status/SystemStatus'
import { ConfigManifestOAuthFlowComponent } from './ConfigManifestOAuthFlow'
import { protectString, unprotectString } from '../../../../lib/lib'
import { SubDevicesConfig } from './DeviceConfigSchemaSettings'
import { SchemaFormForCollection } from '../../../lib/forms/SchemaFormForCollection'
import { JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { PeripheralDevices } from '../../../collections'
import { MeteorCall } from '../../../../lib/api/methods'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface IGenericDeviceSettingsComponentProps {
	device: PeripheralDevice
	subDevices: PeripheralDevice[] | undefined
}

export function GenericDeviceSettingsComponent({
	device,
	subDevices,
}: IGenericDeviceSettingsComponentProps): JSX.Element {
	const { t } = useTranslation()

	const [debugStates, setDebugStates] = useState(() => new Map<PeripheralDeviceId, object>())
	const deviceHasDebugStates = !!(
		device.type === PeripheralDeviceType.PLAYOUT &&
		device.settings &&
		device.settings['debugState']
	)
	useEffect(() => {
		if (deviceHasDebugStates) {
			const interval = setInterval(() => {
				MeteorCall.systemStatus
					.getDebugStates(device._id)
					.then((res) => {
						const states: Map<PeripheralDeviceId, object> = new Map()
						for (const [key, state] of Object.entries<any>(res)) {
							states.set(protectString(key), state)
						}
						setDebugStates(states)
					})
					.catch((err) => console.log(`Error fetching device states: ${err}`))
			}, 1000)

			return () => {
				clearInterval(interval)
			}
		}
	}, [device._id, device.type, device.settings])

	const translationNamespaces = useMemo(() => ['peripheralDevice_' + device._id], [device._id])
	const parsedSchema = useMemo(
		() =>
			device.configManifest.deviceConfigSchema ? JSONBlobParse(device.configManifest.deviceConfigSchema) : undefined,
		[device.configManifest.deviceConfigSchema]
	)

	return (
		<div>
			{device.configManifest.deviceOAuthFlow && (
				<ConfigManifestOAuthFlowComponent device={device}></ConfigManifestOAuthFlowComponent>
			)}

			{parsedSchema ? (
				<>
					<SchemaFormForCollection
						schema={parsedSchema}
						object={device.settings}
						collection={PeripheralDevices}
						objectId={device._id}
						basePath="settings"
						translationNamespaces={translationNamespaces}
						allowTables
					/>

					{device.configManifest.subdeviceManifest && (
						<SubDevicesConfig
							translationNamespaces={translationNamespaces}
							deviceId={device._id}
							commonSchema={device.configManifest.subdeviceConfigSchema}
							configSchema={device.configManifest.subdeviceManifest}
							subDevices={(device.settings as any)?.devices ?? {}}
						/>
					)}
				</>
			) : (
				<p>{t('There is no JSON config schema provided by this Gateway')}</p>
			)}

			{subDevices && subDevices.length > 0 && (
				<React.Fragment>
					<h2 className="mhn">{t('Attached Subdevices')}</h2>
					{subDevices.map((device) => (
						<DeviceItem
							key={unprotectString(device._id)}
							device={device}
							showRemoveButtons={true}
							debugState={debugStates.get(device._id)}
						/>
					))}
				</React.Fragment>
			)}
		</div>
	)
}
