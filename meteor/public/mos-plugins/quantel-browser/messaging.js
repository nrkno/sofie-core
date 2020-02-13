import { xmlStringToObject } from './xml/parser.js'
import { getObjectType, objectTypes } from './mos/mos-helpers.js'

export { initListeners, sendData }

/**
 * Initialize messaging event listeners.
 *
 * @param {Object} callbacks - callbacks for incoming messages
 * @param {function} onNcsItemRequest - callback for a MOS NcsItemRequest
 */
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

/**
 *\ Sends a data payload to a specified window.
 *
 * @param {Window} targetWindow - the window the data will be sent to
 * @param {*} data - the data payload to send
 */
function sendData(targetWindow, data) {
	targetWindow.postMessage(data, '*')
}
