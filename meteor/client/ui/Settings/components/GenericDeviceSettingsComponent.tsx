import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PeripheralDevices, PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { DeviceItem } from '../../Status/SystemStatus'
import { ConfigManifestOAuthFlowComponent } from './ConfigManifestOAuthFlow'
import { unprotectString } from '../../../../lib/lib'
import { SubDevicesConfig } from './DeviceConfigSchemaSettings'
import { SchemaFormForCollection } from '../../../lib/forms/schemaFormForCollection'
import { JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'

interface IGenericDeviceSettingsComponentProps {
	device: PeripheralDevice
	subDevices: PeripheralDevice[] | undefined
}

export function GenericDeviceSettingsComponent({ device, subDevices }: IGenericDeviceSettingsComponentProps) {
	const { t } = useTranslation()

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
						<DeviceItem key={unprotectString(device._id)} device={device} showRemoveButtons={true} />
					))}
				</React.Fragment>
			)}
		</div>
	)
}
