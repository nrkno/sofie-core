import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import React, { useMemo } from 'react'
import _ from 'underscore'
import { i18nTranslator } from '../../ui/i18n'
import { CheckboxControl } from '../Components/Checkbox'
import { TextInputControl } from '../Components/TextInput'
import { EditAttribute } from '../EditAttribute'
import { type JSONSchema, TypeName } from './schema-types'

export function getSchemaDefaultValues(schema: JSONSchema): any {
	switch (schema.type) {
		case TypeName.Object: {
			const object: any = {}

			for (const [index, prop] of Object.entries(schema.properties || {})) {
				object[index] = getSchemaDefaultValues(prop)
			}

			return object
		}
		default:
			return schema.default
	}
}

export interface SchemaFormProps {
	schema: JSONSchema
	object: any
	attr: string
	translationNamespaces?: string[]
	updateFunction?: (path: string, value: any) => void
}
export const SchemaForm = (props: SchemaFormProps) => {
	switch (props.schema.type) {
		case TypeName.Object:
			return <ObjectForm {...props} />
		case TypeName.Integer:
			return <WrappedAttribute {...props} component={<IntegerForm {...props} />} />
		case TypeName.Number:
			return <WrappedAttribute {...props} component={<NumberForm {...props} />} />
		case TypeName.Boolean:
			return <WrappedAttribute {...props} component={<BooleanForm {...props} />} />
		case TypeName.String:
			return <WrappedAttribute {...props} component={<StringForm {...props} />} />
		default:
			return <></>
	}
}

export const ObjectForm = (props: SchemaFormProps) => {
	const updateFunction2 = useMemo(() => {
		const fn = props.updateFunction
		if (fn) {
			return (path: string, value: any) => {
				const path2 = _.compact([props.attr, path])
					.filter((v) => !!v)
					.join('.')

				return fn(path2, value)
			}
		}
	}, [props.attr, props.updateFunction])
	return (
		<>
			{' '}
			{Object.entries(props.schema.properties || {}).map(([index, schema]) => {
				const object = props.attr ? (props.object || {})[props.attr] : props.object
				return <SchemaForm key={index} attr={index} schema={schema} object={object} updateFunction={updateFunction2} />
			})}
		</>
	)
}

export const WrappedAttribute = ({
	schema,
	component,
	translationNamespaces,
	attr,
}: SchemaFormProps & { component: any }) => {
	return (
		<div className={'mod mvs mhs'}>
			{translationNamespaces
				? translateMessage({ key: schema.title || attr, namespaces: translationNamespaces }, i18nTranslator)
				: schema.title || attr}
			<label className="field">{component}</label>
			{schema.description && (
				<span className="text-s dimmed">
					{translationNamespaces
						? translateMessage({ key: schema.description, namespaces: translationNamespaces }, i18nTranslator)
						: schema.description}
				</span>
			)}
		</div>
	)
}

export const IntegerForm = ({ object, attr, updateFunction }: SchemaFormProps) => {
	return (
		<EditAttribute
			type="int"
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
		/>
	)
}

export const NumberForm = ({ object, attr, updateFunction }: SchemaFormProps) => {
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
		/>
	)
}

export const BooleanForm = ({ object, attr, updateFunction }: SchemaFormProps) => {
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

export const StringForm = ({ object, attr, updateFunction }: SchemaFormProps) => {
	return (
		<TextInputControl
			classNames="input text-input input-l"
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
