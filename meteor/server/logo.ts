import { PickerGET } from './api/http'
import * as fs from 'fs'
import { getAbsolutePath } from './lib'
import { getCoreSystemAsync } from './coreSystem/collection'
import { SofieLogo } from '../lib/collections/CoreSystem'

PickerGET.route('/images/sofie-logo.svg', async (_, _2, res) => {
	const core = await getCoreSystemAsync()
	const logo = core?.logo ?? SofieLogo.Default

	const paths: Record<SofieLogo, string> = {
		[SofieLogo.Default]: '/public/images/sofie-logo.svg',
		[SofieLogo.Pride]: '/public/images/sofie-logo-pride.svg',
		[SofieLogo.Norway]: '/public/images/sofie-logo-norway.svg',
		[SofieLogo.Christmas]: '/public/images/sofie-logo-christmas.svg',
	}

	const stream = fs.createReadStream(getAbsolutePath() + paths[logo])

	res.setHeader('Content-Type', 'image/svg+xml')
	res.setHeader('Cache-Control', `public, maxage=600, immutable`)
	res.statusCode = 200
	stream.pipe(res)
})
