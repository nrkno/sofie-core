import { literal } from '@sofie-automation/corelib/dist/lib'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { WrappedOverridableItemNormal, OverrideOpHelper } from '../../ui/Settings/util/OverrideOpHelper'
import { CheckboxControl } from '../Components/Checkbox'
import { DropdownInputOption, DropdownInputControl } from '../Components/DropdownInput'
import { FloatInputControl } from '../Components/FloatInput'
import { IntInputControl } from '../Components/IntInput'
import {
	LabelAndOverrides,
	LabelAndOverridesForCheckbox,
	LabelAndOverridesForDropdown,
	LabelAndOverridesForInt,
} from '../Components/LabelAndOverrides'
import { MultiLineTextInputControl } from '../Components/MultiLineTextInput'
import { TextInputControl } from '../Components/TextInput'
import { JSONSchema, TypeName } from './schema-types'
import { SchemaFormTable } from './schemaFormTable'
import { joinFragments, translateStringIfHasNamespaces } from './schemaFormUtil'

interface SchemaFormWithOverridesProps {
	schema: JSONSchema
	translationNamespaces: string[]

	attr: string

	item: WrappedOverridableItemNormal<any>
	overrideHelper: OverrideOpHelper
}

interface FormComponentProps {
	schema: JSONSchema
	translationNamespaces: string[]
	commonAttrs: {
		label: string
		hint: string | undefined

		item: WrappedOverridableItemNormal<any>
		overrideHelper: OverrideOpHelper
		itemKey: string
		opPrefix: string
	}
}

function useChildPropsForFormComponent(props: SchemaFormWithOverridesProps) {
	return useMemo(() => {
		const title = props.schema['ui:title'] || props.attr
		const description = props.schema['ui:description']

		return {
			schema: props.schema,
			translationNamespaces: props.translationNamespaces,
			commonAttrs: {
				label: translateStringIfHasNamespaces(title, props.translationNamespaces),
				hint: description ? translateStringIfHasNamespaces(description, props.translationNamespaces) : undefined,
				item: props.item,
				itemKey: props.attr,
				opPrefix: props.item.id,
				overrideHelper: props.overrideHelper,
			},
		}
	}, [props.schema, props.translationNamespaces, props.attr, props.item, props.overrideHelper])
}

export function SchemaFormWithOverrides(props: SchemaFormWithOverridesProps) {
	const { t } = useTranslation()

	const childProps = useChildPropsForFormComponent(props)

	switch (props.schema.type) {
		case TypeName.Array:
			return <ArrayFormWithOverrides {...props} />
		case TypeName.Object:
			return <ObjectFormWithOverrides {...props} />
		case TypeName.Integer:
			if (props.schema.enum) {
				return <EnumFormWithOverrides {...childProps} />
			} else {
				return <IntegerFormWithOverrides {...childProps} />
			}
		case TypeName.Number:
			return <NumberFormWithOverrides {...childProps} />
		case TypeName.Boolean:
			return <BooleanFormWithOverrides {...childProps} />
		case TypeName.String:
			if (props.schema.enum) {
				return <EnumFormWithOverrides {...childProps} />
			} else {
				return <StringFormWithOverrides {...childProps} />
			}
		default:
			return <>{t('Unsupported field type "{{ type }}"', { type: props.schema.type })}</>
	}
}

const ArrayFormWithOverrides = (props: SchemaFormWithOverridesProps) => {
	const { t } = useTranslation()

	const childProps = useChildPropsForFormComponent(props)

	switch (props.schema.items?.type) {
		case TypeName.String:
			return <StringArrayFormWithOverrides {...childProps} />
		case TypeName.Object:
			return <SchemaFormTable {...props} />
		default:
			return <>{t('Unsupported array type "{{ type }}"', { type: props.schema.items?.type })}</>
	}
}

const ObjectFormWithOverrides = (props: SchemaFormWithOverridesProps) => {
	return (
		<>
			{' '}
			{Object.entries(props.schema.properties || {}).map(([index, schema]) => {
				const path = joinFragments(props.attr, index)
				return (
					<SchemaFormWithOverrides
						key={index}
						attr={path}
						schema={schema}
						item={props.item}
						overrideHelper={props.overrideHelper}
						translationNamespaces={props.translationNamespaces}
					/>
				)
			})}
		</>
	)
}

const EnumFormWithOverrides = ({ schema, commonAttrs }: FormComponentProps) => {
	const tsEnumNames = (schema['tsEnumNames'] || []) as string[]
	const options = useMemo(() => {
		return (schema.enum || []).map((value: any, i: number) =>
			literal<DropdownInputOption<any>>({
				value,
				name: tsEnumNames[i] || value,
				i,
			})
		)
	}, [schema.enum, tsEnumNames])

	return (
		<div className="mod mvs mhs">
			<LabelAndOverridesForDropdown {...commonAttrs} options={options}>
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
	)
}

const IntegerFormWithOverrides = ({ schema, commonAttrs }: FormComponentProps) => {
	const zeroBased = !!schema['ui:zeroBased']

	return (
		<div className="mod mvs mhs">
			<LabelAndOverridesForInt {...commonAttrs} zeroBased={zeroBased}>
				{(value, handleUpdate) => (
					<IntInputControl
						modifiedClassName="bghl"
						classNames="input text-input input-l"
						placeholder={schema.default}
						zeroBased={zeroBased}
						value={value}
						handleUpdate={handleUpdate}
					/>
				)}
			</LabelAndOverridesForInt>
		</div>
	)
}

const NumberFormWithOverrides = ({ schema, commonAttrs }: FormComponentProps) => {
	return (
		<div className="mod mvs mhs">
			<LabelAndOverrides {...commonAttrs}>
				{(value, handleUpdate) => (
					<FloatInputControl
						modifiedClassName="bghl"
						classNames="input text-input input-l"
						placeholder={schema.default}
						value={value}
						handleUpdate={handleUpdate}
					/>
				)}
			</LabelAndOverrides>
		</div>
	)
}

const BooleanFormWithOverrides = ({ commonAttrs }: FormComponentProps) => {
	return (
		<div className="mod mvs mhs">
			<LabelAndOverridesForCheckbox {...commonAttrs}>
				{(value, handleUpdate) => (
					<CheckboxControl classNames="input" value={value ?? false} handleUpdate={handleUpdate} />
				)}
			</LabelAndOverridesForCheckbox>
		</div>
	)
}

const StringFormWithOverrides = ({ schema, commonAttrs }: FormComponentProps) => {
	return (
		<div className="mod mvs mhs">
			<LabelAndOverrides {...commonAttrs}>
				{(value, handleUpdate) => (
					<TextInputControl
						modifiedClassName="bghl"
						classNames="input text-input input-l"
						placeholder={schema.default}
						value={value}
						handleUpdate={handleUpdate}
					/>
				)}
			</LabelAndOverrides>
		</div>
	)
}

const StringArrayFormWithOverrides = ({ schema, commonAttrs }: FormComponentProps) => {
	return (
		<div className="mod mvs mhs">
			<LabelAndOverrides {...commonAttrs}>
				{(value, handleUpdate) => (
					<MultiLineTextInputControl
						modifiedClassName="bghl"
						classNames="input text-input input-l"
						placeholder={schema.default?.join('\n')}
						value={value || []}
						handleUpdate={handleUpdate}
					/>
				)}
			</LabelAndOverrides>
		</div>
	)
}
