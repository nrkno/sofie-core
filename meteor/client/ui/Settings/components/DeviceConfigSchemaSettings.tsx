import React, { useCallback, useMemo } from 'react'
import { SubdeviceManifest } from '@sofie-automation/corelib/dist/deviceConfig'
import { useTranslation } from 'react-i18next'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { JSONSchema } from '../../../lib/forms/schema-types'
import {
	getSchemaDefaultValues,
	getSchemaSummaryFields,
	SchemaForm,
	SchemaSummaryField,
} from '../../../lib/forms/schemaForm'
import { faCheck, faPencilAlt, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ClassNames from 'classnames'
import { useToggleExpandHelper } from '../util/ToggleExpandedHelper'
import { TextInputControl } from '../../../lib/Components/TextInput'
import { literal, objectPathGet } from '@sofie-automation/corelib/dist/lib'
import { doModalDialog } from '../../../lib/ModalDialog'
import { DropdownInputControl, DropdownInputOption } from '../../../lib/Components/DropdownInput'

interface SchemaSummaryFieldExt extends SchemaSummaryField {
	transform?: (val: any) => string
}

interface SubDevicesConfigProps {
	deviceId: PeripheralDeviceId
	commonSchema: string | undefined
	configSchema: SubdeviceManifest | undefined
	subDevices: Record<string, any>
}

export function SubDevicesConfig({ deviceId, commonSchema, configSchema, subDevices }: SubDevicesConfigProps) {
	const { t } = useTranslation()

	// TODO - avoid hardcoding being at `settings.devices`

	const parsedCommonSchema = commonSchema ? JSON.parse(commonSchema) : undefined

	const parsedSchemas: Record<string, JSONSchema | undefined> = {}
	for (const [id, obj] of Object.entries(configSchema || {})) {
		if (obj.configSchema) {
			parsedSchemas[id] = JSON.parse(obj.configSchema) as JSONSchema
		}
	}
	const schemaTypes = Object.keys(parsedSchemas || {}).sort()

	const subDeviceOptions = useMemo(() => {
		const raw = Object.entries(configSchema || {})
		raw.sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))

		return raw.map(([id, entry], i) =>
			literal<DropdownInputOption<string | number>>({
				value: id + '',
				name: entry.displayName,
				i,
			})
		)
	}, [configSchema])

	const addNewItem = useCallback(() => {
		const selectedType = schemaTypes[0] // TODO - should this be more deterministic?
		const selectedSchemaJson = parsedSchemas[selectedType]
		const defaults = selectedSchemaJson ? getSchemaDefaultValues(selectedSchemaJson) : {}
		defaults.type = selectedType

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

	if (!configSchema || Object.keys(configSchema).length === 0) return <></>

	return (
		<>
			<h2 className="mhn">{t('Attached SubDevices')}</h2>
			<table className="expando settings-studio-device-table table">
				<SubDevicesTable
					parentId={deviceId}
					parsedSchemas={parsedSchemas}
					parsedCommonSchema={parsedCommonSchema}
					subDeviceOptions={subDeviceOptions}
					subDevices={subDevices}
				/>
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
	parsedCommonSchema: JSONSchema | undefined
	subDeviceOptions: DropdownInputOption<string | number>[]
	subDevices: Record<string, any>
}
function SubDevicesTable({
	parentId,
	parsedSchemas,
	parsedCommonSchema,
	subDeviceOptions,
	subDevices,
}: SubDevicesTableProps) {
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

	const singleSchemaMode = Object.keys(parsedSchemas).length === 1

	const schema = Object.values(parsedSchemas)[0]!

	console.log(subDeviceOptions)

	const summaryFields: SchemaSummaryFieldExt[] = singleSchemaMode
		? getSchemaSummaryFields(schema)
		: [
				{
					attr: 'type',
					name: 'Type',
					transform: (val) => subDeviceOptions.find((d) => d.value == val)?.name ?? val,
				},
		  ]

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
				{Object.entries(subDevices).map(([id, device]) => {
					return (
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
									commonSchema={parsedCommonSchema}
									schemas={parsedSchemas}
									subDeviceOptions={subDeviceOptions}
									object={device}
									editItem={toggleExpanded}
								/>
							)}
						</React.Fragment>
					)
				})}
			</tbody>
		</>
	)
}

interface SubDeviceSummaryRowProps {
	summaryFields: SchemaSummaryFieldExt[]
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
		const rawValue = objectPathGet(object, field.attr)
		const value = field.transform ? field.transform(rawValue) : rawValue

		return (
			<td className="settings-studio-device__primary_id c4" key={field.attr}>
				{value ?? ''}
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
	commonSchema: JSONSchema | undefined
	schemas: Record<string, JSONSchema | undefined>
	subDeviceOptions: DropdownInputOption<string | number>[]
	object: any
	editItem: (subdeviceId: string, forceState?: boolean) => void
}
function SubDeviceEditRow({
	parentId,
	subdeviceId,
	commonSchema,
	schemas,
	subDeviceOptions,
	object,
	editItem,
}: SubDeviceEditRowProps) {
	const { t } = useTranslation()

	const schemasArray = Object.values(schemas)
	const schema = schemasArray.length === 1 ? schemasArray[0] : schemas[object?.type]

	console.log(commonSchema, schema, schemas, object)

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
	const updateType = useCallback(
		(val: any) => {
			updateFunction('type', val)
		},
		[updateFunction]
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
					{(schemasArray.length > 1 || !schema) && (
						<div className="mod mvs mhs">
							<label className="field">
								{t('Device Type')}
								<DropdownInputControl
									classNames="input text-input input-l"
									value={object.type + ''}
									options={subDeviceOptions}
									handleUpdate={updateType}
								/>
							</label>
						</div>
					)}
					{commonSchema && (
						<SchemaForm schema={commonSchema} object={object} attr={''} updateFunction={updateFunction} />
					)}
					{schema ? (
						<SchemaForm
							schema={schema}
							object={object}
							attr={commonSchema ? 'options' : '' /** TODO - hack because mos and playout gateway are different... */}
							updateFunction={updateFunction}
						/>
					) : (
						<p>{t('Device is of unknown type')}</p>
					)}
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
