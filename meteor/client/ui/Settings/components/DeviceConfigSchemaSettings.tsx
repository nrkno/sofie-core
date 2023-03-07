import React, { useCallback, useMemo } from 'react'
import { SubdeviceManifest } from '@sofie-automation/corelib/dist/deviceConfig'
import { useTranslation } from 'react-i18next'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { faCheck, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ClassNames from 'classnames'
import { useToggleExpandHelper } from '../util/ToggleExpandedHelper'
import { TextInputControl } from '../../../lib/Components/TextInput'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { doModalDialog } from '../../../lib/ModalDialog'
import { DropdownInputControl, DropdownInputOption } from '../../../lib/Components/DropdownInput'
import { SchemaTableSummaryRow } from '../../../lib/forms/schemaFormTable'
import {
	SchemaSummaryField,
	getSchemaSummaryFields,
	translateStringIfHasNamespaces,
} from '../../../lib/forms/schemaFormUtil'
import { SchemaFormForCollection } from '../../../lib/forms/schemaFormForCollection'
import { getSchemaDefaultValues } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaUtil'
import { JSONBlob, JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { PeripheralDevices } from '../../../collections'

interface SubDevicesConfigProps {
	translationNamespaces: string[]
	deviceId: PeripheralDeviceId
	commonSchema: JSONBlob<JSONSchema> | undefined
	configSchema: SubdeviceManifest | undefined
	subDevices: Record<string, any>
}

export function SubDevicesConfig({
	translationNamespaces,
	deviceId,
	commonSchema,
	configSchema,
	subDevices,
}: SubDevicesConfigProps): JSX.Element {
	const { t } = useTranslation()

	const parsedCommonSchema = commonSchema ? JSONBlobParse(commonSchema) : undefined

	const parsedSchemas: Record<string, JSONSchema | undefined> = {}
	for (const [id, obj] of Object.entries(configSchema || {})) {
		if (obj.configSchema) {
			parsedSchemas[id] = JSONBlobParse(obj.configSchema)
		}
	}
	const schemaTypes = Object.keys(parsedSchemas || {}).sort()

	const subDeviceOptions = useMemo(() => {
		const raw = Object.entries(configSchema || {})
		for (const [_id, obj] of raw) {
			obj.displayName = translateStringIfHasNamespaces(obj.displayName, translationNamespaces)
		}
		raw.sort((a, b) => a[1].displayName.localeCompare(b[1].displayName))

		return raw.map(([id, entry], i) =>
			literal<DropdownInputOption<string | number>>({
				value: id + '',
				name: entry.displayName,
				i,
			})
		)
	}, [configSchema, translationNamespaces])

	const addNewItem = useCallback(() => {
		const selectedType = schemaTypes[0] // Future: This is slightly 'random' but will be consistent
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
					translationNamespaces={translationNamespaces}
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
	translationNamespaces: string[]
	parsedSchemas: Record<string, JSONSchema | undefined>
	parsedCommonSchema: JSONSchema | undefined
	subDeviceOptions: DropdownInputOption<string | number>[]
	subDevices: Record<string, any>
}
function SubDevicesTable({
	parentId,
	translationNamespaces,
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

	const summaryFields: SchemaSummaryField[] = useMemo(() => {
		const singleSchemaMode = Object.keys(parsedSchemas).length === 1

		if (singleSchemaMode) {
			const defaultSchema = Object.values(parsedSchemas)[0]!

			return getSchemaSummaryFields(defaultSchema)
		} else {
			return [
				{
					attr: 'type',
					name: 'Type',
					transform: (val) => subDeviceOptions.find((d) => d.value == val)?.name ?? val,
				},
			]
		}
	}, [parsedSchemas, subDeviceOptions])

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
							<SchemaTableSummaryRow
								summaryFields={summaryFields}
								rowId={id}
								showRowId={true}
								object={device}
								isEdited={isExpanded(id)}
								editItem={toggleExpanded}
								removeItem={confirmRemove}
							/>
							{isExpanded(id) && (
								<SubDeviceEditRow
									parentId={parentId}
									translationNamespaces={translationNamespaces}
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

interface SubDeviceEditRowProps {
	parentId: PeripheralDeviceId
	translationNamespaces: string[]
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
	translationNamespaces,
}: SubDeviceEditRowProps) {
	const { t } = useTranslation()

	const schemasArray = Object.values(schemas)
	const schema = schemasArray.length === 1 ? schemasArray[0] : schemas[object?.type]

	const finishEditItem = useCallback(() => editItem(subdeviceId, false), [editItem, subdeviceId])

	const updateObjectId = useCallback(
		(newId: string) => {
			if (subdeviceId === newId) return

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

	const updateType = useCallback(
		(val: any) => {
			PeripheralDevices.update(parentId, {
				$set: {
					[`settings.devices.${subdeviceId}.type`]: val,
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
						<SchemaFormForCollection
							schema={commonSchema}
							object={object}
							collection={PeripheralDevices}
							objectId={parentId}
							basePath={`settings.devices.${subdeviceId}`}
							translationNamespaces={translationNamespaces}
							allowTables
						/>
					)}
					{schema ? (
						<SchemaFormForCollection
							schema={schema}
							object={object.options}
							collection={PeripheralDevices}
							objectId={parentId}
							basePath={`settings.devices.${subdeviceId}.options`}
							translationNamespaces={translationNamespaces}
							allowTables
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
