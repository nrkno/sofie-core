import { literal } from '@sofie-automation/corelib/dist/lib'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckboxControl } from '../Components/Checkbox'
import { DropdownInputControl, DropdownInputOption } from '../Components/DropdownInput'
import { IntInputControl } from '../Components/IntInput'
import { MultiLineTextInputControl } from '../Components/MultiLineTextInput'
import { TextInputControl } from '../Components/TextInput'
import { EditAttribute } from '../EditAttribute'
import { type JSONSchema, TypeName } from './schema-types'
import { SchemaFormTable } from './schemaFormTable'
import { joinFragments, SchemaFormUpdateFunction, translateStringIfHasNamespaces } from './schemaFormUtil'

export interface SchemaFormProps {
	schema: JSONSchema
	object: any
	attr: string
	translationNamespaces: string[] | undefined
	updateFunction?: SchemaFormUpdateFunction
}
export const SchemaForm = (props: SchemaFormProps) => {
	const { t } = useTranslation()

	switch (props.schema.type) {
		case TypeName.Array:
			return <ArrayForm {...props} />
		case TypeName.Object:
			return <ObjectForm {...props} />
		case TypeName.Integer:
			return (
				<WrappedAttribute
					{...props}
					component={props.schema.enum ? <EnumForm {...props} /> : <IntegerForm {...props} />}
				/>
			)
		case TypeName.Number:
			return (
				<WrappedAttribute
					{...props}
					component={props.schema.enum ? <EnumForm {...props} /> : <NumberForm {...props} />}
				/>
			)
		case TypeName.Boolean:
			return <WrappedAttribute {...props} component={<BooleanForm {...props} />} />
		case TypeName.String:
			return (
				<WrappedAttribute
					{...props}
					component={props.schema.enum ? <EnumForm {...props} /> : <StringForm {...props} />}
				/>
			)
		default:
			return <>{t('Unsupported field type "{{ type }}"', { type: props.schema.type })}</>
	}
}

const ArrayForm = (props: SchemaFormProps) => {
	const { t } = useTranslation()

	const updateFunction2 = useMemo((): SchemaFormUpdateFunction | undefined => {
		const fn = props.updateFunction
		if (fn) {
			return (path: string, value: any, mode) => {
				const path2 = joinFragments(props.attr, path)

				return fn(path2, value, mode)
			}
		}
	}, [props.attr, props.updateFunction])

	switch (props.schema.items?.type) {
		case TypeName.String:
			return <WrappedAttribute {...props} component={<StringArrayForm {...props} />} />
		case TypeName.Object:
			return (
				<SchemaFormTable
					schema={props.schema}
					translationNamespaces={props.translationNamespaces}
					object={props.object[props.attr]}
					updateFunction={updateFunction2}
				/>
			)
		default:
			return <>{t('Unsupported array type "{{ type }}"', { type: props.schema.items?.type })}</>
	}
}

const ObjectForm = (props: SchemaFormProps) => {
	const updateFunction2 = useMemo((): SchemaFormUpdateFunction | undefined => {
		const fn = props.updateFunction
		if (fn) {
			return (path: string, value: any, mode) => {
				const path2 = joinFragments(props.attr, path)

				return fn(path2, value, mode)
			}
		}
	}, [props.attr, props.updateFunction])

	return (
		<>
			{' '}
			{Object.entries(props.schema.properties || {}).map(([index, schema]) => {
				const object = props.attr ? (props.object || {})[props.attr] : props.object
				return (
					<SchemaForm
						key={index}
						attr={index}
						schema={schema}
						object={object}
						updateFunction={updateFunction2}
						translationNamespaces={props.translationNamespaces}
					/>
				)
			})}
		</>
	)
}

const WrappedAttribute = ({ schema, component, translationNamespaces, attr }: SchemaFormProps & { component: any }) => {
	const title = schema['ui:title'] || attr
	const description = schema['ui:description']

	return (
		<div className={'mod mvs mhs'}>
			{translateStringIfHasNamespaces(title, translationNamespaces)}
			<label className="field">{component}</label>
			{description && (
				<span className="text-s dimmed">{translateStringIfHasNamespaces(description, translationNamespaces)}</span>
			)}
		</div>
	)
}

const EnumForm = ({ object, attr, updateFunction, schema }: SchemaFormProps) => {
	const tsEnumNames = ((schema as any).tsEnumNames || []) as string[]
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
		<DropdownInputControl
			classNames="input text-input input-l"
			value={object[attr]}
			options={options}
			handleUpdate={(v) => {
				if (updateFunction) {
					updateFunction(attr, v)
				} else {
					object[attr] = v
				}
			}}
		/>
	)
}

const IntegerForm = ({ object, attr, updateFunction, schema }: SchemaFormProps) => {
	return (
		<IntInputControl
			classNames="input text-input input-l"
			placeholder={schema.default}
			value={object[attr]}
			zeroBased={schema['ui:zeroBased']}
			handleUpdate={(v) => {
				if (updateFunction) {
					updateFunction(attr, v)
				} else {
					object[attr] = v
				}
			}}
		/>
	)
}

const NumberForm = ({ object, attr, updateFunction, schema }: SchemaFormProps) => {
	return (
		<EditAttribute
			type="float"
			attribute={attr}
			obj={object}
			updateFunction={(_, v) => {
				if (updateFunction) {
					updateFunction(attr, v)
				} else {
					object[attr] = v
				}
			}}
			className="input text-input input-l"
			label={schema.default}
		/>
	)
}

const BooleanForm = ({ object, attr, updateFunction }: SchemaFormProps) => {
	return (
		<CheckboxControl
			classNames="input input-l"
			value={object[attr]}
			handleUpdate={(v) => {
				if (updateFunction) {
					updateFunction(attr, v)
				} else {
					object[attr] = v
				}
			}}
		/>
	)
}

const StringForm = ({ object, attr, updateFunction, schema }: SchemaFormProps) => {
	return (
		<TextInputControl
			classNames="input text-input input-l"
			value={object[attr] ?? false}
			handleUpdate={(v) => {
				if (updateFunction) {
					updateFunction(attr, v)
				} else {
					object[attr] = v
				}
			}}
			placeholder={schema.default}
		/>
	)
}

const StringArrayForm = ({ object, attr, updateFunction, schema }: SchemaFormProps) => {
	return (
		<MultiLineTextInputControl
			classNames="input text-input input-l"
			modifiedClassName="bghl"
			value={object[attr] || []}
			handleUpdate={(v) => {
				if (updateFunction) {
					updateFunction(attr, v)
				} else {
					object[attr] = v
				}
			}}
			placeholder={schema.default?.join('\n')}
		/>
	)
}
