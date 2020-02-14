import { QuantelAgent } from '../agents/quantel/quantel-agent.js'
import { createQuantelClipNcsItem } from '../mos/ncsItemCreator.js'
import { getSelected } from '../state.js'

export { init }

const classNames = {
	CLIP_LIST: 'clips',
	CLIP_ITEM: 'clip'
}

const dataAttributeNames = {
	CLIP: 'clip'
}

/**
 * Performs a search on the Quantel Server using the query parameters from
 * the request querystring and creates a list of the items found.
 *
 * Sets up event listeneres for user interaction with the list, and calls
 * the given callbacks provided.
 *
 * @param {object} callbacks
 * @param {function} callbacks.onTargetSelect - called when user selects a clip
 * @param {function} callbacks.onTargetCancel - called when the user cancels a clip selection
 */
async function init({ onTargetSelect, onTargetCancel }) {
	const params = new URLSearchParams(document.location.search.substring(1))
	const server = params.get('server')
	const titleQuery = params.get('title')
	const poolIdQuery = params.get('poolId')
	const createdQuery = params.get('created')

	const clips = await performSearch({
		server,
		query: { title: titleQuery, poolId: poolIdQuery, created: createdQuery }
	})
	buildClipList(clips)
	setupDragTracking(classNames.CLIP_ITEM, {
		onDragStart: (clipItem, dataTransfer) => {
			const guid = clipItem.dataset[dataAttributeNames.GUID]
			if (guid) {
				onTargetSelect(guid)

				const ncsItem = createQuantelClipNcsItem(getSelected())
				dataTransfer.setData('text', new XMLSerializer().serializeToString(ncsItem))
			}
		},
		onDragEnd: (clipItem) => {
			const guid = clipItem.dataset[dataAttributeNames.GUID]
			if (guid) {
				onTargetCancel(guid)
			}
		}
	})
}

function setupDragTracking(className, { onDragStart, onDragEnd }) {
	document.addEventListener('dragstart', ({ target, dataTransfer }) => {
		if (target.classList.contains(className)) {
			onDragStart(target, dataTransfer)
		}
	})

	document.addEventListener('dragend', ({ target }) => {
		if (target.classList.contains(className)) {
			onDragEnd(target)
		}
	})
}

function buildClipList(clips) {
	const resultsList = document.querySelector(`.${classNames.CLIP_LIST}`)
	clips.forEach((clip) => {
		const clipListelement = createClipListElement(clip)
		resultsList.appendChild(clipListelement)
	})
}

async function performSearch({ server, query }) {
	const quantelAgent = new QuantelAgent(server)
	const result = await quantelAgent.searchClip({ title: query.title })

	return result.clips
}

function createClipListElement(clip) {
	const listItem = document.createElement('li')
	listItem.setAttribute('draggable', true)
	listItem.classList.add(classNames.CLIP_ITEM)
	listItem.textContent = clip.title
	listItem.dataset[dataAttributeNames.GUID] = clip.guid

	return listItem
}
