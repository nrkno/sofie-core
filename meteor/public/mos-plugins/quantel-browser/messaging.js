import { xmlStringToObject } from './xml/parser.js'
import { getObjectType, objectTypes } from './mos/mos-helpers.js'

export { initListeners, sendData }

function initListeners({ onNcsItemRequest }) {
	window.addEventListener('message', ({ data }) => {
		try {
			const obj = xmlStringToObject(data)
			const messageType = getObjectType(obj)
			switch (messageType) {
				case objectTypes.MOS_NCS_ITEM_REQUEST:
					onNcsItemRequest()
					break
			}
		} catch (error) {
			console.log('Discarded incoming message (unable to parse):', data)
		}
	})
}

function sendData(targetWindow, data) {
	targetWindow.postMessage(data, '*')
}
