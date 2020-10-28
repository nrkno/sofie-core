const Ajv = require('ajv')
const tsj = require('ts-json-schema-generator')

const tsjConfig = {
	path: './dist/config.d.ts',
	expose: 'export',
	topRef: true
}

const ajv = new Ajv({
	allErrors: true,
	extendRefs: 'fail',
	format: 'full'
})

const schemaGenerator = tsj.createGenerator(tsjConfig)
const faceValidator = ajv.compile(schemaGenerator.createSchema('BasicConfigManifestEntry'))

const matches = faceValidator({
	id: 'aaa',
	name: 'Aaa',
	description: 'No?',
	required: false,
	type: 'layer_mappings',
	defaultVal: ['abc'],
	multiple: true
})
console.log('errors', matches, faceValidator.errors)
