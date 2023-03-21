---
sidebar_label: JSON Config Schema
sidebar_position: 7
---

# JSON Config Schema

So that Sofie does not have to be aware of every type of gateway that may connect to it, each gateway provides a manifest describing itself and the configuration fields that it has.

Since Release 50, this is done using [JSON Schemas](https://json-schema.org/). This allows schemas to be written, with typescript interfaces generated from the schema, and for the same schema to be used to render a flexible UI.
We recommend using [json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript) to generate typescript interfaces.

Only a subset of the JSON Schema specification is supported, and some additional properties are used for the UI.

We expect this subset to grow over time as more sections are found to be useful to us, but we may proceed cautiously to avoid constantly breaking other applications that use TSR and these schemas.

## Non-standard properties

We use some non-standard properties to help the UI render with friendly names.

### `ui:title`

Title of the property

### `ui:description`

Description/hint for the property

### `ui:summaryTitle`

If set, when in a table this property will be used as part of the summary with this label

### `ui:zeroBased`

If an integer property, whether to treat it as zero-based

### `ui:displayType`

Override the presentation with a special mode.
Currently only valid for string properties. Valid values are 'json'.

### `tsEnumNames`

This is primarily for `json-schema-to-typescript`.

Names of the enum values as generated for the typescript enum, which we display in the UI instead of the raw values

## Supported types

Any JSON Schema property or type is allowed, but will be ignored if it is not supported.

In general, if a `default` is provided, we will use that as a placeholder in the input field.

### `object`

This should be used as the root of your schema, and can be used anywhere inside it. The properties inside any object will be shown if they are supported.

You may want to set the `title` property to generate a typescript interface for it.

### `integer`

`enum` can be set with an array of values to turn it into a dropdown

### `number`

### `boolean`

### `string`

`enum` can be set with an array of values to turn it into a dropdown

### `array`

The behaviour of this depends on the type of the `items`.

#### `string`

This is treated as a multi-line string, stored as an array of strings.

#### `object`

This is not available in all places we use this schema. For example, Mappings are unable to use this, but device configuration is. Additionally, using it inside of another object-array is not allowed.

## Examples

Below is an example of a simple schema for a gateway configuration. The subdevices are handled separetely, with their own schema.

```
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"$id": "https://example.com/product.schema.json",
	"title": "Mos Gateway Config",
	"type": "object",
	"properties": {
		"mosId": {
			"type": "string",
			"ui:title": "MOS ID of Mos-Gateway (Sofie MOS ID)",
			"ui:description": "MOS ID of the Sofie MOS device (ie our ID). Example: sofie.mos",
			"default": ""
		},
		"debugLogging": {
			"type": "boolean",
			"ui:title": "Activate Debug Logging",
			"default": false
		}
	},
	"required": ["mosId"],
	"additionalProperties": false
}
```
