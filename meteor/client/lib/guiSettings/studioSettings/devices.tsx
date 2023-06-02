import React, { useCallback, useState } from 'react'
import { TFunction } from 'react-i18next'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { GUISetting, GUISettingId, GUISettingSection, GUISettingsType, guiSettingId } from '../guiSettings'
import { Studio } from '../../../../lib/collections/Studios'
import { EditAttribute, IEditAttribute } from '../../EditAttribute'
import { PeripheralDevices } from '../../../collections'
import { defaultEditAttributeProps } from '../lib'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { useTracker } from '../../ReactMeteorData/ReactMeteorData'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { MomentFromNow } from '../../Moment'

export function devicesProperties(props: {
	t: TFunction
	studio: Studio
	urlBase: string
}): (GUISetting<any> | GUISettingSection)[] {
	const { t, studio, urlBase } = props
	const settings: (GUISetting<any> | GUISettingSection)[] = []

	// Note: Non-reactive when called directly:
	const getStudioDevices = () => {
		return PeripheralDevices.find({
			studioId: studio._id,
		}).fetch()
	}

	const devices = getStudioDevices()

	for (const device of devices) {
		const settingId = guiSettingId(urlBase, 'device', unprotectString(device._id))
		settings.push({
			type: GUISettingsType.SECTION,
			name: device.name || 'Unnamed device',
			description: t('Device of type "{{type}}"', { type: device.type }),
			id: settingId,
			// getWarning: () => {
			// 	return getStudioDevices().length === 0 && t('No devices attached')
			// },
			getList: () => {
				return deviceProperties(t, settingId, device)
			},
			getSearchString: '',
		})
	}

	settings.push({
		type: GUISettingsType.SETTING,
		name: t('Add device'),
		description: t('Add a device to the studio'),
		id: guiSettingId(urlBase, 'add-device'),
		getWarning: () => {
			return getStudioDevices().length === 0 && t('No devices attached')
		},
		render: AddDeviceToStudio,
		renderProps: { t, studioId: studio._id },
		getSearchString: getStudioDevices()
			.map((s) => s.name)
			.join(' '),
	})

	return settings
}

const AddDeviceToStudio: React.FC<{ t: TFunction; studioId: StudioId }> = ({ t, studioId }) => {
	const [showAvailableDevices, setShowAvailableDevices] = useState(false)

	const availableDevices = useTracker(
		() =>
			PeripheralDevices.find(
				{
					studioId: {
						$not: {
							$eq: studioId,
						},
					},
					parentDeviceId: {
						$exists: false,
					},
				},
				{
					sort: {
						lastConnected: -1,
					},
				}
			).fetch(),
		[studioId],
		[]
	)
	const addDeviceToStudio = useCallback(
		(deviceId: PeripheralDeviceId) => {
			setShowAvailableDevices(false)
			PeripheralDevices.update(deviceId, {
				$set: {
					studioId: studioId,
				},
			})
		},
		[studioId]
	)
	return (
		<>
			<button
				className="btn btn-primary"
				onClick={() => {
					setShowAvailableDevices(!showAvailableDevices)
				}}
			>
				<FontAwesomeIcon icon={faPlus} />
			</button>
			{showAvailableDevices && (
				<div className="border-box text-s studio-devices-dropdown">
					<div className="ctx-menu">
						{availableDevices.length > 0 ? (
							availableDevices.map((device) => (
								<div
									key={unprotectString(device._id)}
									className="ctx-menu-item"
									onClick={() => {
										addDeviceToStudio(device._id)
									}}
								>
									<b>{device.name}</b> <MomentFromNow date={device.lastSeen} /> ({unprotectString(device._id)})
								</div>
							))
						) : (
							<div
								className="ctx-menu-item"
								onClick={() => {
									setShowAvailableDevices(false)
								}}
							>
								{t('No available devices')}
							</div>
						)}
					</div>
				</div>
			)}
		</>
	)
}

function deviceProperties(
	t: TFunction,
	baseSettingId: GUISettingId,
	device: PeripheralDevice
): (GUISetting<any> | GUISettingSection)[] {
	const settings: (GUISetting<any> | GUISettingSection)[] = []

	const editAttributeProps = literal<Partial<IEditAttribute>>({
		...defaultEditAttributeProps,
		obj: device,
		collection: PeripheralDevices,
	})

	settings.push(
		literal<GUISetting<IEditAttribute>>({
			type: GUISettingsType.SETTING,
			name: t('Name'),
			description: t('Name of the device'),
			id: guiSettingId(baseSettingId, 'name'),
			getWarning: () => {
				return !device.name && t('Missing device name')
			},
			render: (props) => <EditAttribute {...props} />,
			renderProps: {
				...editAttributeProps,
				type: 'text',
				attribute: 'name',
			},

			getSearchString: device.name,
		})
	)

	// TODO: Add device options here

	return settings
}
