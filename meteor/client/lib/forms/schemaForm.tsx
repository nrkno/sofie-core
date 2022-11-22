import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import React from 'react'
import { i18nTranslator } from '../../ui/i18n'
import { EditAttribute } from '../EditAttribute'
import { type JSONSchema, TypeName } from './schema-types'

export interface SchemaFormProps {
	schema: JSONSchema
	object: any
	attr: string
	translationNamespaces?: string[]
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
	return (
		<>
			{' '}
			{Object.entries(props.schema.properties || {}).map(([index, schema]) => {
				return <SchemaForm key={index} {...props} attr={index} schema={schema} />
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

export const IntegerForm = ({ object, attr }: SchemaFormProps) => {
	return (
		<EditAttribute
			type="int"
			attribute={attr}
			obj={object}
			updateFunction={(_, v) => (object[attr] = v)}
			className="input text-input input-l"
		/>
	)
}

export const NumberForm = ({ object, attr }: SchemaFormProps) => {
	return (
		<EditAttribute
			type="float"
			attribute={attr}
			obj={object}
			updateFunction={(_, v) => (object[attr] = v)}
			className="input text-input input-l"
		/>
	)
}

export const BooleanForm = ({ object, attr }: SchemaFormProps) => {
	return (
		<EditAttribute
			type="checkbox"
			attribute={attr}
			obj={object}
			updateFunction={(_, v) => (object[attr] = v)}
			className="input input-l"
		/>
	)
}

export const StringForm = ({ object, attr }: SchemaFormProps) => {
	return (
		<EditAttribute
			type="text"
			attribute={attr}
			obj={object}
			updateFunction={(_, v) => (object[attr] = v)}
			className="input text-input input-l"
		/>
	)
}
