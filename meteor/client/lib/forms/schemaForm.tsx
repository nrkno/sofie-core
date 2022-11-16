import React from 'react'
import { EditAttribute } from '../EditAttribute'
import { type JSONSchema, TypeName } from './schema-types'

export interface SchemaFormProps {
	schema: JSONSchema
	object: any
	attr: string
}
export const SchemaForm = (props: SchemaFormProps) => {
	switch (props.schema.type) {
		case TypeName.Object:
			return <ObjectForm {...props} />
		case TypeName.Integer:
			return <WrappedAttribute schema={props.schema} component={<IntegerForm {...props} />} />
		case TypeName.Number:
			return <WrappedAttribute schema={props.schema} component={<NumberForm {...props} />} />
		case TypeName.Boolean:
			return <WrappedAttribute schema={props.schema} component={<BooleanForm {...props} />} />
		case TypeName.String:
			return <WrappedAttribute schema={props.schema} component={<BooleanForm {...props} />} />
		default:
			return <></>
	}
}

export const ObjectForm = ({ schema, object }: { schema: JSONSchema; object: any }) => {
	return (
		<>
			{' '}
			{Object.entries(schema.properties || {}).map(([index, schema]) => {
				return <SchemaForm key={index} attr={index} schema={schema} object={object} />
			})}
		</>
	)
}

export const WrappedAttribute = ({ schema, component }: { schema: JSONSchema; component: any }) => {
	return (
		<div className={'mod mvs mhs'}>
			{schema.title || 'title'}
			<label className="field">{component}</label>
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
			className="input input-l"
		/>
	)
}
