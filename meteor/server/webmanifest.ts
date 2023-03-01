import os from 'os'
import { PickerGET } from './api/http'
import { ServerResponse } from 'http'
import type {
	JSONSchemaForWebApplicationManifestFiles,
	ManifestImageResource,
	ShortcutItem,
} from '../lib/typings/webmanifest'
import { getCoreSystemAsync } from '../lib/collections/CoreSystem'
import { logger } from '../lib/logging'
import { MongoQuery } from '../lib/typings/meteor'
import { DBStudio, Studios } from '../lib/collections/Studios'
import { Rundowns } from '../lib/collections/Rundowns'
import { DBRundownPlaylist, RundownPlaylists } from '../lib/collections/RundownPlaylists'
import { getLocale, Translations } from './lib'
import { generateTranslation } from '../lib/lib'
import { ITranslatableMessage } from '@sofie-automation/blueprints-integration'
import { interpollateTranslation } from '@sofie-automation/corelib/dist/TranslatableMessage'

const appShortName = 'Sofie'
const SOFIE_DEFAULT_ICONS: ManifestImageResource[] = [
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
]

const t = generateTranslation

function translateMessage(locale: Translations, message: ITranslatableMessage): string {
	const localized = locale[message.key] || message.key
	return interpollateTranslation(localized, message.args)
}

function getShortcutsForStudio(
	locale: Translations,
	studio: Pick<DBStudio, '_id' | 'name'>,
	studioCount: number
): ShortcutItem[] {
	const multiStudio = studioCount > 1
	return [
		{
			id: `${studio._id}_activeRundown`,
			name: translateMessage(
				locale,
				multiStudio
					? t('{{studioName}}: Active Rundown', {
							studioName: studio.name,
					  })
					: t('Active Rundown')
			),
			icons: SOFIE_DEFAULT_ICONS,
			url: `/activeRundown/${studio._id}`,
		},
		{
			id: `${studio._id}_prompter`,
			name: translateMessage(
				locale,
				multiStudio
					? t('{{studioName}}: Prompter', {
							studioName: studio.name,
					  })
					: t('Prompter')
			),
			icons: SOFIE_DEFAULT_ICONS,
			url: `/prompter/${studio._id}`,
		},
		{
			id: `${studio._id}_countdowns`,
			name: translateMessage(
				locale,
				multiStudio ? t('{{studioName}}: Presenter screen', { studioName: studio.name }) : t('Presenter screen')
			),
			icons: SOFIE_DEFAULT_ICONS,
			url: `/countdowns/${studio._id}/presenter`,
		},
	]
}

async function getWebManifest(languageCode: string): Promise<JSONSchemaForWebApplicationManifestFiles> {
	const shortcuts: ShortcutItem[] = []

	const [core, studios, locale] = await Promise.all([
		getCoreSystemAsync(),
		Studios.findFetchAsync({}),
		getLocale(languageCode),
	])

	studios.forEach((studio) => {
		shortcuts.push(...getShortcutsForStudio(locale, studio, studios.length))
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

	let rundownPlaylistSelector: MongoQuery<DBRundownPlaylist>
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

/**
 * Serve a localized version of the WebManifest. It will return an English version by default, one can specify a
 * supported locale using ?lng=XX URL query parameter. Uses the same localisation files as the Frontend app.
 */
PickerGET.route('/site.webmanifest', async (_, req, res) => {
	logger.debug(`WebManifest: ${req.socket.remoteAddress} GET "${req.url}"`, {
		url: req.url,
		method: 'GET',
		remoteAddress: req.socket.remoteAddress,
		remotePort: req.socket.remotePort,
		headers: req.headers,
	})

	let lngCode = 'en' // EN is the default locale
	if (req.url) {
		const url = new URL(req.url, 'http://s/') // the second part needs to be a dummy url, we just want to parse the URL query
		lngCode = url.searchParams.get('lng') || lngCode
	}

	try {
		const manifest = await getWebManifest(lngCode)

		res.statusCode = 200
		res.setHeader('Content-Type', 'application/manifest+json;charset=utf-8')
		res.end(JSON.stringify(manifest))
	} catch (e) {
		logger.error(`Could not produce PWA WebManifest`, e)
		sendResponseCode(res, 500, 'Internal Server Error')
	}
})

/**
 * Handle the web+nrcs://rundown/<NRCS-EXTERNAL-ID> URL scheme. This allows for external integrations to direct the User
 * to a Sofie Rundown View of a given Rundown or Rundown Playlist.
 */
PickerGET.route('/url/nrcs', async (_, req, res) => {
	logger.debug(`NRCS URL: ${req.socket.remoteAddress} GET "${req.url}"`, {
		url: req.url,
		method: 'GET',
		remoteAddress: req.socket.remoteAddress,
		remotePort: req.socket.remotePort,
		headers: req.headers,
	})

	if (!req.url) {
		sendResponseCode(res, 400, 'Needs query parameter "q"')
		return
	}

	try {
		const url = new URL(req.url, 'http://s/') // the second part needs to be a dummy url, we just want to parse the URL query
		const webNrcsUrl = url.searchParams.get('q')
		if (webNrcsUrl === null) {
			sendResponseCode(res, 400, 'Needs query parameter "q"')
			return
		}

		// Unfortunately, URL interface can't handle custom URL schemes like web+something, so we need to use the
		// URL interface and trick it into parsing the URL-encoded externalId
		const parsedWebNrcsUrl = new URL(webNrcsUrl.replace(/^web\+nrcs:\/\//, 'http://'))
		if (parsedWebNrcsUrl.host === 'rundown') {
			webNrcsRundownRoute(res, parsedWebNrcsUrl)
			return
		}

		sendResponseCode(res, 400, `Unsupported namespace: "${parsedWebNrcsUrl.host}"`)
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

function webNrcsRundownRoute(res: ServerResponse, parsedUrl: URL) {
	// the "path" will contain the initial forward slash, so we need to strip that out
	const externalId = decodeURIComponent(parsedUrl.pathname.substring(1))
	if (externalId === null) {
		sendResponseCode(res, 400, 'Needs an External ID to be provided')
		return
	}

	const rundownPlaylist = getRundownPlaylistFromExternalId(externalId)

	if (!rundownPlaylist) {
		// we couldn't find the External ID for Rundown/Rundown Playlist
		logger.debug(`NRCS URL: External ID not found "${externalId}"`)
		sendResponseCode(res, 303, `Could not find requested object: "${externalId}", see the full list`, '/')
		return
	}

	logger.debug(`NRCS URL: External ID found "${externalId}" in "${rundownPlaylist._id}"`)
	sendResponseCode(
		res,
		302,
		`Requested object found in Rundown Playlist "${rundownPlaylist._id}"`,
		`/rundown/${rundownPlaylist._id}`
	)
}
