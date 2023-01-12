import React, { useCallback } from 'react'
import { SubdeviceManifest } from '@sofie-automation/corelib/dist/deviceConfig'
import { useTranslation } from 'react-i18next'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { JSONSchema } from '../../../lib/forms/schema-types'
import { getSchemaDefaultValues, getSchemaSummaryFields, SchemaForm } from '../../../lib/forms/schemaForm'
import { faCheck, faPencilAlt, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ClassNames from 'classnames'
import { useToggleExpandHelper } from '../util/ToggleExpandedHelper'
import { TextInputControl } from '../../../lib/Components/TextInput'
import { objectPathGet } from '@sofie-automation/corelib/dist/lib'
import { doModalDialog } from '../../../lib/ModalDialog'

interface SubDevicesConfigProps {
	deviceId: PeripheralDeviceId
	configSchema?: SubdeviceManifest
	subDevices: Record<string, any>
}

export function SubDevicesConfig({ deviceId, configSchema, subDevices }: SubDevicesConfigProps) {
	const { t } = useTranslation()

	// TODO - avoid hardcoding being at `settings.devices`

	const parsedSchemas: Record<string, JSONSchema | undefined> = {}
	for (const [id, obj] of Object.entries(configSchema || {})) {
		if (obj.configSchema) {
			parsedSchemas[id] = JSON.parse(obj.configSchema) as JSONSchema
		}
	}
	const schemaTypes = Object.keys(parsedSchemas || {})

	const addNewItem = useCallback(() => {
		const selectedSchemaJson = parsedSchemas[schemaTypes[0]]
		const defaults = selectedSchemaJson ? getSchemaDefaultValues(selectedSchemaJson) : {}

		const existingDevices = new Set(Object.keys((PeripheralDevices.findOne(deviceId)?.settings as any)?.devices || {}))

		let idx = 0
		while (existingDevices.has(`device${idx}`)) {
			idx++
		}

		// set db
		PeripheralDevices.update(deviceId, {
			$set: {
				[`settings.devices.device${idx}`]: defaults,
			},
		})
	}, [])

	if (schemaTypes.length !== 1) return <p>TODO</p>

	if (!configSchema || Object.keys(configSchema).length === 0) return <></>

	return (
		<>
			<h2 className="mhn">{t('Attached SubDevices')}</h2>
			<table className="expando settings-studio-device-table table">
				<SubDevicesTable parentId={deviceId} parsedSchemas={parsedSchemas} subDevices={subDevices} />
			</table>

			<div className="mod mhs">
				<button className="btn btn-primary" onClick={addNewItem}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</>
	)
}

interface SubDevicesTableProps {
	parentId: PeripheralDeviceId
	parsedSchemas: Record<string, JSONSchema | undefined>
	subDevices: Record<string, any>
}
function SubDevicesTable({ parentId, parsedSchemas, subDevices }: SubDevicesTableProps) {
	const { t } = useTranslation()
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const confirmRemove = useCallback(
		(subdeviceId: string) => {
			doModalDialog({
				title: t('Remove this item?'),
				no: t('Cancel'),
				yes: t('Remove'),
				onAccept: () => {
					PeripheralDevices.update(parentId, {
						$unset: {
							[`settings.devices.${subdeviceId}`]: 1,
						},
					})
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
		[t, parentId]
	)

	const schemaTypes = Object.keys(parsedSchemas)
	if (schemaTypes.length !== 1) throw new Error('TODO')

	const schema = Object.values(parsedSchemas)[0]!

	const summaryFields = schemaTypes.length === 1 ? getSchemaSummaryFields(schema) : []

	return (
		<>
			<thead>
				<tr className="hl">
					<th key="ID">ID</th>
					{summaryFields.map((col) => (
						<th key={col.attr}>{col.name}</th>
					))}
					<th key="action">&nbsp;</th>
				</tr>
			</thead>
			<tbody>
				{Object.entries(subDevices).map(([id, device]) => (
					<React.Fragment key={id}>
						<SubDeviceSummaryRow
							summaryFields={summaryFields}
							subdeviceId={id}
							object={device}
							isEdited={isExpanded(id)}
							editItem={toggleExpanded}
							removeItem={confirmRemove}
						/>
						{isExpanded(id) && (
							<SubDeviceEditRow
								parentId={parentId}
								subdeviceId={id}
								schema={schema}
								object={device}
								editItem={toggleExpanded}
							/>
						)}
					</React.Fragment>
				))}
			</tbody>
		</>
	)
}

interface SubDeviceSummaryRowProps {
	summaryFields: { attr: string; name: string }[]
	subdeviceId: string
	object: any
	isEdited: boolean
	editItem: (subdeviceId: string) => void
	removeItem: (subdeviceId: string) => void
}

function SubDeviceSummaryRow({
	summaryFields,
	subdeviceId,
	object,
	isEdited,
	editItem,
	removeItem,
}: SubDeviceSummaryRowProps) {
	const els: Array<JSX.Element> = summaryFields.map((field) => {
		// TODO - reimplement?
		// 	if (field === (configManifest.typeField || 'type') && configManifest.deviceTypesMapping) {
		// 		val = configManifest.deviceTypesMapping[val]
		// 	}

		return (
			<td className="settings-studio-device__primary_id c4" key={field.attr}>
				{objectPathGet(object, field.attr) ?? ''}
			</td>
		)
	})

	const editItem2 = useCallback(() => editItem(subdeviceId), [editItem, subdeviceId])
	const removeItem2 = useCallback(() => removeItem(subdeviceId), [removeItem, subdeviceId])

	return (
		<tr
			className={ClassNames({
				hl: isEdited,
			})}
		>
			<th className="settings-studio-device__name c2">{subdeviceId}</th>
			{els}
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

interface SubDeviceEditRowProps {
	parentId: PeripheralDeviceId
	subdeviceId: string
	schema: JSONSchema
	object: any
	editItem: (subdeviceId: string, forceState?: boolean) => void
}
function SubDeviceEditRow({ parentId, subdeviceId, schema, object, editItem }: SubDeviceEditRowProps) {
	const { t } = useTranslation()

	const finishEditItem = useCallback(() => editItem(subdeviceId, false), [editItem, subdeviceId])

	const updateObjectId = useCallback(
		(newId: string) => {
			const parentDevice = PeripheralDevices.findOne(parentId)
			if (!parentDevice) throw new Error('Parent device does not exist!')

			const existingDevices = (parentDevice.settings as any)?.devices
			if (existingDevices[newId]) throw new Error(`Device "${newId}" already exists`)

			const oldDeviceConfig = existingDevices[subdeviceId] || {}
			PeripheralDevices.update(parentId, {
				$set: {
					[`settings.devices.${newId}`]: oldDeviceConfig,
				},
				$unset: {
					[`settings.devices.${subdeviceId}`]: 1,
				},
			})

			// toggle ui visibility
			editItem(subdeviceId, false)
			editItem(newId, true)
		},
		[parentId, subdeviceId, editItem]
	)

	const updateFunction = useCallback(
		(path: string, val: any) => {
			PeripheralDevices.update(parentId, {
				$set: {
					[`settings.devices.${subdeviceId}.${path}`]: val,
				},
			})
		},
		[parentId, subdeviceId]
	)

	return (
		<tr className="expando-details hl" key={subdeviceId + '-details'}>
			<td colSpan={99}>
				<div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Device ID')}
							<TextInputControl
								classNames="input text-input input-l"
								modifiedClassName="bghl"
								value={subdeviceId}
								handleUpdate={updateObjectId}
							/>
						</label>
					</div>
					<SchemaForm schema={schema} object={object} attr={''} updateFunction={updateFunction} />
				</div>
				<div className="mod alright">
					<button className={ClassNames('btn btn-primary')} onClick={finishEditItem}>
						<FontAwesomeIcon icon={faCheck} />
					</button>
				</div>
			</td>
		</tr>
	)
}
