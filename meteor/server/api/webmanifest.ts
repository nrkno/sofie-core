import os from 'os'
import { PickerGET } from './http'
import type { JSONSchemaForWebApplicationManifestFiles, ShortcutItem } from '../../lib/typings/webmanifest'
import { getCoreSystem } from '../../lib/collections/CoreSystem'
import { logger } from '../../lib/logging'
import { DBStudio, Studios } from '../../lib/collections/Studios'

const appShortName = 'Sofie'

function getShortcutsForStudio(studio: Pick<DBStudio, '_id' | 'name'>, studioCount: number): ShortcutItem[] {
	const multiStudio = studioCount > 1
	return [
		{
			id: `${studio._id}_activeRundown`,
			name: multiStudio ? `${studio.name}: Active Rundown` : 'Active Rundown',
			url: `/activeRundown/${studio._id}`,
		},
		{
			id: `${studio._id}_prompter`,
			name: multiStudio ? `${studio.name}: Prompter` : 'Prompter',
			url: `/prompter/${studio._id}`,
		},
		{
			id: `${studio._id}_countdowns`,
			name: multiStudio ? `${studio.name}: Presenter screen` : 'Presenter screen',
			url: `/countdowns/${studio._id}/presenter`,
		},
	]
}

function getWebManifest(): JSONSchemaForWebApplicationManifestFiles {
	const core = getCoreSystem()

	const studios = Studios.find().fetch()

	const shortcuts: ShortcutItem[] = []

	studios.forEach((studio) => {
		shortcuts.push(...getShortcutsForStudio(studio, studios.length))
	})

	const csName = core?.name
	const coreId = core?._id || os.hostname()

	return {
		$schema: 'https://json.schemastore.org/web-manifest.json',
		id: `no.nrk.sofie-core.${coreId}`,
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
		],
		theme_color: '#2d89ef',
		background_color: '#252627',
		display: 'fullscreen',
		start_url: '/',
		scope: '/',
		orientation: 'landscape',
		shortcuts: shortcuts.length > 0 ? shortcuts : undefined,
		protocol_handlers: [
			{
				protocol: 'web+nrcs',
				url: '/url/nrcs?q=%s',
			},
		],
	}
}

PickerGET.route('/site.webmanifest', (_, req, res) => {
	logger.debug(`WebManifest: ${req.connection.remoteAddress} GET "${req.url}"`, {
		url: req.url,
		method: 'GET',
		remoteAddress: req.connection.remoteAddress,
		remotePort: req.connection.remotePort,
		headers: req.headers,
	})

	try {
		res.statusCode = 200
		res.setHeader('Content-Type', 'application/manifest+json')
		res.end(JSON.stringify(getWebManifest()))
		return
	} catch (e) {
		logger.error(`Could not produce PWA WebManifest`, e)
	}

	res.statusCode = 500
	res.end('Internal Server Error')
})
