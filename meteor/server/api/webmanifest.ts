import { PickerGET } from './http'
import type { JSONSchemaForWebApplicationManifestFiles } from '../../lib/typings/webmanifest'
import { getCoreSystem } from '../../lib/collections/CoreSystem'
import { logger } from '../../lib/logging'

const appShortName = 'Sofie'

function buildManifest(): JSONSchemaForWebApplicationManifestFiles {
	const core = getCoreSystem()

	const csName = core?.name

	return {
		$schema: 'https://json.schemastore.org/web-manifest.json',
		name: csName ? `${appShortName} – ${csName}` : `${appShortName}`,
		short_name: appShortName,
		icons: [
			{
				src: '/icons/android-chrome-192x192.png',
				sizes: '192x192',
				purpose: 'any',
				type: 'image/png',
			},
			{
				src: '/icons/android-chrome-512x512.png',
				sizes: '512x512',
				purpose: 'any',
				type: 'image/png',
			},
			{
				src: '/icons/mstile-144x144.png',
				sizes: '144x144',
				purpose: 'monochrome',
				type: 'image/png',
			},
			{
				src: '/icons/maskable-96x96.png',
				sizes: '96x96',
				purpose: 'maskable',
				type: 'image/png',
			},
			{
				src: '/icons/maskable-512x512.png',
				sizes: '512x512',
				purpose: 'maskable',
				type: 'image/png',
			},
			{
				src: '/icons/monochrome-512x512.png',
				sizes: '512x512',
				purpose: 'monochrome',
				type: 'image/png',
			},
		],
		theme_color: '#2d89ef',
		background_color: '#252627',
		display: 'fullscreen',
		start_url: '/',
		scope: '/',
		orientation: 'landscape',
		protocol_handlers: [
			{
				protocol: 'web+nrcs',
				url: '/url/nrcs?q=%s',
			},
		],
	}
}

PickerGET.route('/site.webmanifest', (_, req, res) => {
	logger.info(`WebManifest: ${req.connection.remoteAddress} GET "${req.url}"`, {
		url: req.url,
		method: 'GET',
		remoteAddress: req.connection.remoteAddress,
		remotePort: req.connection.remotePort,
		headers: req.headers,
	})

	try {
		res.statusCode = 200
		res.setHeader('Content-Type', 'application/manifest+json')
		res.end(JSON.stringify(buildManifest()))
		return
	} catch (e) {
		logger.error(`Could not produce PWA WebManifest`, e)
	}

	res.statusCode = 500
	res.end('Internal Server Error')
})
