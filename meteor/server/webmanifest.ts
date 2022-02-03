import os from 'os'
import { PickerGET } from './api/http'
import { ServerResponse } from 'http'
import type { JSONSchemaForWebApplicationManifestFiles, ShortcutItem } from '../lib/typings/webmanifest'
import { getCoreSystem } from '../lib/collections/CoreSystem'
import { logger } from '../lib/logging'
import { MongoSelector } from '../lib/typings/meteor'
import { DBStudio, Studios } from '../lib/collections/Studios'
import { Rundowns } from '../lib/collections/Rundowns'
import { DBRundownPlaylist, RundownPlaylists } from '../lib/collections/RundownPlaylists'

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

function getRundownPlaylistFromExternalId(externalId: string): DBRundownPlaylist | undefined {
	const rundown = Rundowns.findOne({ externalId })

	let rundownPlaylistSelector: MongoSelector<DBRundownPlaylist>
	if (rundown) {
		rundownPlaylistSelector = {
			_id: rundown.playlistId,
		}
	} else {
		rundownPlaylistSelector = {
			externalId,
		}
	}

	return RundownPlaylists.findOne(rundownPlaylistSelector)
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

	sendResponseCode(res, 500, 'Internal Server Error')
})

PickerGET.route('/url/nrcs', (_, req, res) => {
	logger.debug(`NRCS URL: ${req.connection.remoteAddress} GET "${req.url}"`, {
		url: req.url,
		method: 'GET',
		remoteAddress: req.connection.remoteAddress,
		remotePort: req.connection.remotePort,
		headers: req.headers,
	})

	if (!req.url) {
		sendResponseCode(res, 400, 'Needs query parameter "q"')
		return
	}

	try {
		const url = new URL(req.url, 'http://s/') // the second part needs to be a dummy url, we just want to parse the URL query
		const externalId = url.searchParams.get('q')
		if (externalId === null) {
			sendResponseCode(res, 400, 'Needs query parameter "q"')
			return
		}

		const rundownPlaylist = getRundownPlaylistFromExternalId(externalId)

		if (!rundownPlaylist) {
			// we couldn't find the External ID for Rundown/Rundown Playlist
			logger.debug(`NRCS URL: External ID not found "${externalId}"`)
			sendResponseCode(res, 303, `Could not find requested object: "${externalId}", see the full list`, '/')
			return
		}
		logger.debug(`NRCS URL: External ID found "${rundownPlaylist._id}"`)
		sendResponseCode(
			res,
			302,
			`Requested object found in Rundown Playlist "${rundownPlaylist._id}"`,
			`/rundown/${rundownPlaylist._id}`
		)
		return
	} catch (e) {
		logger.error(`Unknown error in /url/nrcs`, e)
	}

	sendResponseCode(res, 500, 'Internal Server Error')
})

function sendResponseCode(res: ServerResponse, code: number, description: string, redirect?: string): void {
	res.statusCode = code
	if (redirect) {
		res.setHeader('Location', redirect)
	}
	res.end(description)
}
