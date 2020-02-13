import { xmlStringToObject } from '../../xml/parser.js'

export { QuantelAgent }

const REQUESTS = {
	CLIPS: {
		path: '/quantel/homezone/clips/search',
		params: {
			QUERY: 'q'
		}
	}
}

class QuantelAgent {
	constructor(host) {
		this.host = host
	}

	searchClip(query) {
		const { path, params } = REQUESTS.CLIPS
		const url = new URL(this.host)
		url.pathname = path
		url.searchParams.append(params.QUERY, `Title:${query.title}`)
		return fetch(url.href)
			.then((response) => response.text())
			.then((xmlString) => xmlStringToObject(xmlString))
			.then((results) => {
				const { entry } = results.feed
				const clips = Array.isArray(entry) ? [...entry] : [entry]

				return { clips: clips.map(mapClipData) }
			})
	}
}

function mapClipData({ content }) {
	return {
		guid: content.ClipGUID,
		title: content.Title,
		frames: content.Frames
	}
}
