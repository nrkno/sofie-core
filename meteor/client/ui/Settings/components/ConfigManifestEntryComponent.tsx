import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { EditAttribute } from '../../../lib/EditAttribute'
import {
	ConfigManifestEntry as BlueprintConfigManifestEntry,
	ConfigManifestEntryType,
} from '@sofie-automation/blueprints-integration'
import { MongoCollection } from '../../../../lib/collections/lib'
import { PeripheralDevices } from '../../../collections'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides'
import classNames from 'classnames'

const renderEditAttribute = (
	collection: MongoCollection<any>,
	configField: BlueprintConfigManifestEntry,
	obj: object,
	prefix?: string
): JSX.Element | undefined => {
	const attribute = prefix + configField.id
	const opts = {
		modifiedClassName: 'bghl',
		attribute,
		obj,
		collection,
	}

	if (configField.type === ConfigManifestEntryType.FLOAT) {
		return <EditAttribute {...opts} type="float" className="input text-input input-l"></EditAttribute>
	} else if (configField.type === ConfigManifestEntryType.INT) {
		return (
			<EditAttribute
				{...opts}
				type={'int'}
				className="input text-input input-l"
				mutateDisplayValue={(v) => (configField.zeroBased ? v + 1 : v)}
				mutateUpdateValue={(v) => (configField.zeroBased ? v - 1 : v)}
			></EditAttribute>
		)
	} else if (configField.type === ConfigManifestEntryType.STRING) {
		return <EditAttribute {...opts} type="text" className="input text-input input-l"></EditAttribute>
	} else if (configField.type === ConfigManifestEntryType.BOOLEAN) {
		return <EditAttribute {...opts} type="checkbox" className="input input-l"></EditAttribute>
	} else if (configField.type === ConfigManifestEntryType.ENUM) {
		return (
			<EditAttribute
				{...opts}
				type="dropdown"
				options={configField.options || []}
				className="input text-input input-l"
			></EditAttribute>
		)
	} else if (configField.type === ConfigManifestEntryType.MULTILINE_STRING) {
		return (
			<EditAttribute
				{...opts}
				modifiedClassName="bghl"
				type="multiline"
				className="input text-input input-l"
				mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? undefined : v.join('\n'))}
				mutateUpdateValue={(v) =>
					v === undefined || v.length === 0 ? undefined : v.split('\n').map((i) => i.trimStart())
				}
			/>
		)
		// } else {
		// 	assertNever(configField.type)
	}
}

export interface IConfigManifestEntryComponentProps {
	configField: BlueprintConfigManifestEntry
	obj: object
	prefix?: string
	collection?: MongoCollection<any>
	className?: string
}

/** @deprecated */
export function ConfigManifestEntryComponent({
	configField,
	obj,
	prefix,
	collection,
	className,
}: IConfigManifestEntryComponentProps): JSX.Element {
	const { t } = useTranslation() // TODO - should this use a namespace?

	return (
		<label className={classNames('field', className)}>
			<LabelActual label={t(configField.name)} />
			{renderEditAttribute(collection || PeripheralDevices, configField, obj, prefix)}
			{configField.hint && <span className="text-s dimmed field-hint">{t(configField.hint)}</span>}
		</label>
	)
}
