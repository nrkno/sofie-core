import { init as uiInit } from './ui/index.js'
import { setSelected, getSelected, clearSelected } from './state.js'
import { initListeners as messagingInitListeners, sendData } from './messaging.js'
import { create } from './mos/ncsItemCreator.js'

uiInit({
	onTargetCancel: () => {
		const cleared = clearSelected()
		console.log('Target cancel', cleared.guid, getSelected())
	},
	onTargetSelect: (clip) => {
		setSelected(clip)
		console.log('Target select', clip.guid, getSelected())
	}
})

messagingInitListeners({
	onNcsItemRequest: () => {
		const selected = getSelected()
		if (selected && window.parent) {
			const ncsItem = create(selected)
			sendData(window.parent, ncsItem)
		}
	}
})
