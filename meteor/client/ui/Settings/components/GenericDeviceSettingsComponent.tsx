import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PeripheralDevices, PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { DeviceItem } from '../../Status/SystemStatus'
import { ConfigManifestOAuthFlowComponent } from './ConfigManifestOAuthFlow'
import { unprotectString } from '../../../../lib/lib'
import { SchemaForm } from '../../../lib/forms/schemaForm'
import { SubDevicesConfig } from './DeviceConfigSchemaSettings'
import { SchemaFormUpdateFunction } from '../../../lib/forms/schemaFormUtil'

interface IGenericDeviceSettingsComponentProps {
	device: PeripheralDevice
	subDevices: PeripheralDevice[] | undefined
}

export function GenericDeviceSettingsComponent({ device, subDevices }: IGenericDeviceSettingsComponentProps) {
	const { t } = useTranslation()

	const translationNamespaces = useMemo(() => ['peripheralDevice_' + device._id], [device._id])
	const parsedSchema = useMemo(
		() => (device.configManifest.deviceConfigSchema ? JSON.parse(device.configManifest.deviceConfigSchema) : undefined),
		[device.configManifest.deviceConfigSchema]
	)

	const updateFunction: SchemaFormUpdateFunction = useCallback(
		(path, val, mode) => {
			if (mode === 'push') {
				console.log('NOT IMPLEMENTED', mode)
			} else if (mode === 'pull') {
				console.log('NOT IMPLEMENTED', mode)
			} else if (val === undefined) {
				PeripheralDevices.update(device._id, {
					$unset: {
						[`settings.${path}`]: 1,
					},
				})
			} else {
				PeripheralDevices.update(device._id, {
					$set: {
						[`settings.${path}`]: val,
					},
				})
			}
		},
		[device._id]
	)

	return (
		<div>
			{device.configManifest.deviceOAuthFlow && (
				<ConfigManifestOAuthFlowComponent device={device}></ConfigManifestOAuthFlowComponent>
			)}

			{device.configManifest.deviceConfigSchema ? (
				<>
					<SchemaForm
						schema={parsedSchema}
						object={device.settings}
						attr=""
						updateFunction={updateFunction}
						translationNamespaces={translationNamespaces}
					/>

					{device.configManifest.subdeviceManifest && (
						<SubDevicesConfig
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
