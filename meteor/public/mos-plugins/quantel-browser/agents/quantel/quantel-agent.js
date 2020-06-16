import { xmlStringToObject } from '../../xml/parser.js'

export { QuantelAgent }

const REQUESTS = {
	CLIP_SEARCH: {
		path: '/quantel/homezone/clips/search',
		params: {
			QUERY: 'q'
		}
	}
}

/** Agent for quering a Quantel media server */
class QuantelAgent {
	/**
	 * Create an agent.
	 *
	 * @param {string} host - Address to the Quantel server to query
	 */
	constructor(host) {
		this.host = host
	}

	/**
	 * Search for clips matching the given criteria.
	 *
	 * Special note on the created criteria:
	 * Solr date search syntax used. Example for everything created within the last 2 days:
	 * [NOW-2DAY/DAY TO NOW]
	 *
	 * @param {object} criteria - query criteria
	 * @param {string} criteria.title - clip title criteria. * is allowed as a wildcard
	 * @param {string} criteria.poolId - scope the search to a specified pool
	 * @param {string} criteria.created - scope the search to clips created in a specific period
	 *
	 * @returns {Promise} - a promise containing the search results
	 */
	searchClip(criteria) {
		const { path, params } = REQUESTS.CLIP_SEARCH
		const url = new URL(this.host)
		url.pathname = path
		const queryParamValue = buildQueryParam(criteria)
		url.searchParams.append(params.QUERY, queryParamValue)

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

function buildQueryParam({ title, poolId, created }) {
	const titleFragment = `Title:${title || '*'}`
	const poolIdFragment = poolId ? ` AND PoolID:${poolId}` : ''
	const createdFragment = created ? `AND Created:${created}` : ''

	return `${titleFragment}${poolIdFragment}${createdFragment}`
}
