import React, { useCallback, useMemo } from 'react'
import { Studios } from '../../../../collections'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { PeripheralDevice, PeripheralDeviceCategory } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { getHelpMode } from '../../../../lib/localStorage'
import Tooltip from 'rc-tooltip'
import { useTranslation } from 'react-i18next'
import {
	OverrideOpHelper,
	WrappedOverridableItem,
	WrappedOverridableItemDeleted,
	WrappedOverridableItemNormal,
	getAllCurrentAndDeletedItemsFromOverrides,
	useOverrideOpHelper,
} from '../../util/OverrideOpHelper'
import {
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { StudioPlayoutDevice } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { faCheck, faPencilAlt, faPlus, faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { JSONBlob, JSONBlobParse, JSONSchema, TSR } from '@sofie-automation/blueprints-integration'
import { DropdownInputControl, DropdownInputOption } from '../../../../lib/Components/DropdownInput'
import { useToggleExpandHelper } from '../../util/ToggleExpandedHelper'
import { doModalDialog } from '../../../../lib/ModalDialog'
import classNames from 'classnames'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { SubdeviceManifest } from '@sofie-automation/corelib/dist/deviceConfig'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { TextInputControl } from '../../../../lib/Components/TextInput'
import { SchemaFormWithOverrides } from '../../../../lib/forms/SchemaFormWithOverrides'
import { LabelAndOverridesForDropdown } from '../../../../lib/Components/LabelAndOverrides'

interface PeripheralDeviceTranslated {
	_id: PeripheralDeviceId
	name: string
	subdeviceConfigSchema: JSONBlob<JSONSchema> | undefined
	subdeviceManifest: SubdeviceManifest
}

interface StudioPlayoutSubDevicesProps {
	studioId: StudioId
	studioDevices: PeripheralDevice[]
}
export function StudioPlayoutSubDevices({ studioId, studioDevices }: StudioPlayoutSubDevicesProps): JSX.Element {
	const { t } = useTranslation()

	const studio = useTracker(() => Studios.findOne(studioId), [studioId])

	const saveOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			if (studio?._id) {
				Studios.update(studio._id, {
					$set: {
						'peripheralDeviceSettings.playoutDevices.overrides': newOps,
					},
				})
			}
		},
		[studio?._id]
	)

	const baseSettings = useMemo(
		() => studio?.peripheralDeviceSettings?.playoutDevices ?? wrapDefaultObject({}),
		[studio?.peripheralDeviceSettings?.playoutDevices]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, baseSettings)

	const playoutDevices = useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides<StudioPlayoutDevice>(baseSettings, (a, b) => a[0].localeCompare(b[0])),
		[baseSettings]
	)

	const studioDevicesMap = useMemo(() => {
		const devicesMap = new Map<PeripheralDeviceId, PeripheralDeviceTranslated>()

		for (const device of studioDevices) {
			if (device.category === PeripheralDeviceCategory.PLAYOUT) {
				devicesMap.set(
					device._id,
					literal<PeripheralDeviceTranslated>({
						_id: device._id,
						name: device.name || unprotectString(device._id),
						subdeviceConfigSchema: device.configManifest.subdeviceConfigSchema,
						subdeviceManifest: device.configManifest.subdeviceManifest,
					})
				)
			}
		}

		return devicesMap
	}, [studioDevices])

	const addNewItem = useCallback(() => {
		const existingDevices = new Set(playoutDevices.map((d) => d.id))
		let idx = 0
		while (existingDevices.has(`device${idx}`)) {
			idx++
		}

		const newId = `device${idx}`
		const newDevice = literal<StudioPlayoutDevice>({
			peripheralDeviceId: undefined,
			options: {
				type: TSR.DeviceType.ABSTRACT,
			},
		})

		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newId,
			value: newDevice,
		})

		Studios.update(studioId, {
			$push: {
				'peripheralDeviceSettings.playoutDevices.overrides': addOp,
			},
		})
	}, [studioId, playoutDevices])

	return (
		<div>
			<h2 className="mhn">
				<Tooltip
					overlay={t('Playout devices are needed to control your studio hardware')}
					visible={getHelpMode() && !playoutDevices.length}
					placement="right"
				>
					<span>{t('Playout Devices')}</span>
				</Tooltip>
			</h2>

			<table className="expando settings-studio-device-table table">
				<SubDevicesTable
					subDevices={playoutDevices}
					overrideHelper={overrideHelper}
					peripheralDevices={studioDevicesMap} // TODO - filter by type
				/>
			</table>

			<div className="mod mhs">
				<button className="btn btn-primary" onClick={addNewItem}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>

			{playoutDevices.length === 0 && <p>{t('No playout devices have been added yet')}</p>}
		</div>
	)
}

interface SubDevicesTableProps {
	subDevices: WrappedOverridableItem<StudioPlayoutDevice>[]
	overrideHelper: OverrideOpHelper
	peripheralDevices: Map<PeripheralDeviceId, PeripheralDeviceTranslated>
}
function SubDevicesTable({ subDevices, overrideHelper, peripheralDevices }: SubDevicesTableProps) {
	const { t } = useTranslation()
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const confirmRemove = useCallback(
		(subdeviceId: string) => {
			doModalDialog({
				title: t('Remove this device?'),
				no: t('Cancel'),
				yes: t('Remove'),
				onAccept: () => {
					overrideHelper.deleteItem(subdeviceId)
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to remove {{type}} "{{deviceId}}"?', {
								type: 'device',
								deviceId: subdeviceId,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		},
		[t, overrideHelper]
	)

	const peripheralDeviceOptions = useMemo(() => {
		const options: DropdownInputOption<PeripheralDeviceId | undefined>[] = [
			{
				value: undefined,
				name: 'Unassigned',
				i: 0,
			},
		]

		for (const device of peripheralDevices.values()) {
			options.push({
				value: device._id,
				name: device.name || unprotectString(device._id),
				i: options.length,
			})
		}

		return options
	}, [peripheralDevices])

	return (
		<>
			<thead>
				<tr className="hl">
					<th key="ID">ID</th>
					<th key="Parent">{t('Parent')}</th>
					<th key="Type">{t('Type')}</th>
					<th key="action">&nbsp;</th>
				</tr>
			</thead>
			<tbody>
				{subDevices.map((item) => {
					if (item.type === 'deleted') {
						const peripheralDevice =
							item.defaults.peripheralDeviceId && peripheralDevices.get(item.defaults.peripheralDeviceId)
						return (
							<DeletedSummaryRow
								key={item.id}
								item={item}
								peripheralDevice={peripheralDevice}
								doUndelete={overrideHelper.resetItem}
							/>
						)
					} else {
						const peripheralDevice =
							item.computed.peripheralDeviceId && peripheralDevices.get(item.computed.peripheralDeviceId)

						return (
							<React.Fragment key={item.id}>
								<SummaryRow
									item={item}
									peripheralDevice={peripheralDevice}
									isEdited={isExpanded(item.id)}
									editItem={toggleExpanded}
									removeItem={confirmRemove}
								/>
								{isExpanded(item.id) && (
									<SubDeviceEditRow
										peripheralDevice={peripheralDevice}
										peripheralDeviceOptions={peripheralDeviceOptions}
										editItem={toggleExpanded}
										item={item}
										overrideHelper={overrideHelper}
									/>
								)}
							</React.Fragment>
						)
					}
				})}
			</tbody>
		</>
	)
}

interface SummaryRowProps {
	item: WrappedOverridableItemNormal<StudioPlayoutDevice>
	peripheralDevice: PeripheralDeviceTranslated | undefined
	isEdited: boolean
	editItem: (rowId: string) => void
	removeItem: (rowId: string) => void
}
function SummaryRow({ item, peripheralDevice, isEdited, editItem, removeItem }: SummaryRowProps): JSX.Element {
	const editItem2 = useCallback(() => editItem(item.id), [editItem, item.id])
	const removeItem2 = useCallback(() => removeItem(item.id), [removeItem, item.id])

	const deviceType = peripheralDevice
		? peripheralDevice.subdeviceManifest[item.computed.options.type]?.displayName ?? '-'
		: '-'

	return (
		<tr
			className={classNames({
				hl: isEdited,
			})}
		>
			<th className="settings-studio-device__name c2">{item.id}</th>

			<th className="settings-studio-device__parent c2">
				{peripheralDevice?.name || item.computed.peripheralDeviceId || '-'}
			</th>

			<th className="settings-studio-device__type c2">{deviceType}</th>

			<td className="settings-studio-device__actions table-item-actions c1" key="action">
				<button className="action-btn" onClick={editItem2}>
					<FontAwesomeIcon icon={faPencilAlt} />
				</button>
				<button className="action-btn" onClick={removeItem2}>
					<FontAwesomeIcon icon={faTrash} />
				</button>
			</td>
		</tr>
	)
}

interface DeletedSummaryRowProps {
	item: WrappedOverridableItemDeleted<StudioPlayoutDevice>
	peripheralDevice: PeripheralDeviceTranslated | undefined
	doUndelete: (rowId: string) => void
}
function DeletedSummaryRow({ item, peripheralDevice, doUndelete }: DeletedSummaryRowProps): JSX.Element {
	const doUndeleteItem = useCallback(() => doUndelete(item.id), [doUndelete, item.id])

	const deviceType = peripheralDevice
		? peripheralDevice.subdeviceManifest[item.defaults.options.type]?.displayName ?? '-'
		: '-'

	return (
		<tr>
			<th className="settings-studio-device__name c2 deleted">{item.id}</th>

			<th className="settings-studio-device__parent c2 deleted">
				{peripheralDevice?.name || item.defaults.peripheralDeviceId || '-'}
			</th>

			<th className="settings-studio-device__type c2 deleted">{deviceType}</th>

			<td className="settings-studio-device__actions table-item-actions c1" key="action">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}

interface SubDeviceEditRowProps {
	peripheralDevice: PeripheralDeviceTranslated | undefined
	peripheralDeviceOptions: DropdownInputOption<PeripheralDeviceId | undefined>[]
	editItem: (subdeviceId: string, forceState?: boolean) => void
	item: WrappedOverridableItemNormal<StudioPlayoutDevice>
	overrideHelper: OverrideOpHelper
}
function SubDeviceEditRow({
	peripheralDevice,
	peripheralDeviceOptions,
	editItem,
	item,
	overrideHelper,
}: // translationNamespaces,
SubDeviceEditRowProps) {
	const { t } = useTranslation()

	const finishEditItem = useCallback(() => editItem(item.id, false), [editItem, item.id])

	const updateObjectId = useCallback(
		(newId: string) => {
			if (item.id === newId) return

			overrideHelper.changeItemId(item.id, newId)

			// toggle ui visibility
			editItem(item.id, false)
			editItem(newId, true)
		},
		[item.id, overrideHelper, editItem]
	)

	return (
		<tr className="expando-details hl" key={item.id + '-details'}>
			<td colSpan={99}>
				<div>
					<div className="mod mvs mhs">
						<LabelAndOverridesForDropdown
							label={t('Peripheral Device ID')}
							item={item}
							overrideHelper={overrideHelper}
							opPrefix={item.id}
							itemKey={'peripheralDeviceId'}
							options={peripheralDeviceOptions}
						>
							{(value, handleUpdate, options) => (
								<DropdownInputControl
									classNames="input text-input input-l"
									options={options}
									value={value}
									handleUpdate={handleUpdate}
								/>
							)}
						</LabelAndOverridesForDropdown>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Device ID')}
							<TextInputControl
								classNames="input text-input input-l"
								modifiedClassName="bghl"
								value={item.id}
								handleUpdate={updateObjectId}
								disabled={!!item.defaults}
							/>
						</label>
					</div>

					{!item.computed.peripheralDeviceId && (
						<p>{t('This must be assigned to a device to be able to edit the settings')}</p>
					)}

					{!peripheralDevice && item.computed.peripheralDeviceId && <p>{t('Parent device is missing')}</p>}

					{peripheralDevice && (
						<SubDeviceEditForm peripheralDevice={peripheralDevice} item={item} overrideHelper={overrideHelper} />
					)}
				</div>
				<div className="mod alright">
					<button className={classNames('btn btn-primary')} onClick={finishEditItem}>
						<FontAwesomeIcon icon={faCheck} />
					</button>
				</div>
			</td>
		</tr>
	)
}

interface SubDeviceEditFormProps {
	peripheralDevice: PeripheralDeviceTranslated
	item: WrappedOverridableItemNormal<StudioPlayoutDevice>
	overrideHelper: OverrideOpHelper
}
function SubDeviceEditForm({ peripheralDevice, item, overrideHelper }: SubDeviceEditFormProps) {
	const { t } = useTranslation()

	const parsedCommonSchema = useMemo((): JSONSchema | undefined => {
		if (peripheralDevice?.subdeviceConfigSchema) {
			return JSONBlobParse(peripheralDevice.subdeviceConfigSchema)
		}

		return undefined
	}, [peripheralDevice, item.computed.options.type])

	const parsedSchema = useMemo((): JSONSchema | undefined => {
		if (peripheralDevice) {
			const subdeviceManifest = peripheralDevice.subdeviceManifest[item.computed.options.type]
			if (subdeviceManifest) {
				return JSONBlobParse(subdeviceManifest.configSchema)
			}
		}

		return undefined
	}, [peripheralDevice, item.computed.options.type])

	const subdeviceTypeOptions = useMemo((): DropdownInputOption<unknown>[] => {
		const options: DropdownInputOption<unknown>[] = []

		for (const [id, info] of Object.entries<SubdeviceManifest[0]>(peripheralDevice.subdeviceManifest)) {
			options.push({
				name: info.displayName,
				value: id + '',
				i: options.length,
			})
		}

		return options
	}, [peripheralDevice])

	const translationNamespaces = useMemo(() => ['peripheralDevice_' + peripheralDevice._id], [peripheralDevice._id])

	return (
		<>
			{(subdeviceTypeOptions.length > 1 || !parsedSchema) && (
				<div className="mod mvs mhs">
					<LabelAndOverridesForDropdown
						label={t('Device Type')}
						item={item}
						overrideHelper={overrideHelper}
						opPrefix={item.id}
						itemKey={'options.type' as any}
						options={subdeviceTypeOptions}
					>
						{(value, handleUpdate, options) => (
							<DropdownInputControl
								classNames="input text-input input-l"
								options={options}
								value={value + ''}
								handleUpdate={handleUpdate}
							/>
						)}
					</LabelAndOverridesForDropdown>
				</div>
			)}

			{parsedCommonSchema && (
				<SchemaFormWithOverrides
					schema={parsedCommonSchema}
					attr={'options'}
					item={item}
					overrideHelper={overrideHelper}
					translationNamespaces={translationNamespaces}
					allowTables
				/>
			)}

			{parsedSchema ? (
				<SchemaFormWithOverrides
					schema={parsedSchema}
					attr={'options.options'}
					item={item}
					overrideHelper={overrideHelper}
					translationNamespaces={translationNamespaces}
					allowTables
				/>
			) : (
				<p>{t('Device is of unknown type')}</p>
			)}
		</>
	)
}
