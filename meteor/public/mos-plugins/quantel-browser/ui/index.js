import { QuantelAgent } from '../agents/quantel/quantel-agent.js'

export { init }

const classNames = {
	CLIP_LIST: 'clips',
	CLIP_ITEM: 'clip'
}

const dataAttributeNames = {
	CLIP: 'clip'
}

async function init({ onTargetSelect, onTargetCancel }) {
	const params = new URLSearchParams(document.location.search.substring(1))
	const server = params.get('server')
	const titleQuery = params.get('title')

	const clips = await performSearch({ server, query: { title: titleQuery } })
	buildClipList(clips)
	setupDragTracking(classNames.CLIP_ITEM, {
		onDragStart: (clipItem) => {
			const guid = clipItem.dataset[dataAttributeNames.GUID]
			if (guid) {
				onTargetSelect(guid)
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
	document.addEventListener('dragstart', ({ target }) => {
		if (target.classList.contains(className)) {
			onDragStart(target)
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
