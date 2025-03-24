import { compileFromFile } from 'json-schema-to-typescript'
import * as fs from 'fs/promises'

/** ********************************************************
 *
 * This script goes through the json-schemas of all devices (located under /$schemas )
 * and auto-generates types for those schemas
 *
 ***********************************************************/
const BANNER =
	'/* eslint-disable */\n/**\n * This file was automatically generated by json-schema-to-typescript.\n * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,\n * and run "yarn generate-schema-types" to regenerate this file.\n */\n'

const PrettierConf = JSON.parse(
	await fs.readFile('./node_modules/@sofie-automation/code-standard-preset/.prettierrc.json')
)

// convert playout-gateway options
try {
	const schema = await compileFromFile('./playout-gateway/src/$schemas/options.json', {
		additionalProperties: false,
		style: PrettierConf,
		bannerComment: '',
	})

	await fs.writeFile('./shared-lib/src/generated/PlayoutGatewayConfigTypes.ts', BANNER + '\n' + schema)
} catch (e) {
	console.error('Error while generating playout-gateway options.json, continuing...')
	console.error(e)
}

// convert mos-gateway options
try {
	const schema = await compileFromFile('./mos-gateway/src/$schemas/options.json', {
		additionalProperties: false,
		style: PrettierConf,
		bannerComment: '',
	})

	await fs.writeFile('./shared-lib/src/generated/MosGatewayOptionsTypes.ts', BANNER + '\n' + schema)
} catch (e) {
	console.error('Error while generating mos-gateway options.json, continuing...')
	console.error(e)
}
try {
	const schema = await compileFromFile('./mos-gateway/src/$schemas/devices.json', {
		additionalProperties: false,
		style: PrettierConf,
		bannerComment: '',
	})

	await fs.writeFile('./shared-lib/src/generated/MosGatewayDevicesTypes.ts', BANNER + '\n' + schema)
} catch (e) {
	console.error('Error while generating mos-gateway devices.json, continuing...')
	console.error(e)
}

// convert live-status-gateway options
try {
	const schema = await compileFromFile('./live-status-gateway/src/$schemas/options.json', {
		additionalProperties: false,
		style: PrettierConf,
		bannerComment: '',
	})

	await fs.writeFile('./shared-lib/src/generated/LiveStatusGatewayOptionsTypes.ts', BANNER + '\n' + schema)
} catch (e) {
	console.error('Error while generating live-status-gateway options.json, continuing...')
	console.error(e)
}
