namespace modifierHelper {
	const activeModifiers: {
		[key: string]: boolean
	} = {}

	function setMap(name: string, e: KeyboardEvent, value: boolean) {
		if (e.location === 2) {
			activeModifiers[name + 'Right'] = value
		} else {
			activeModifiers[name + 'Left'] = value
		}
	}

	function handleKeyEvent(e: KeyboardEvent) {
		const value = e.type === 'keydown' ? true : false

		switch (e.key) {
			case 'Alt':
				setMap('alt', e, value)
				break
			case 'Control':
				setMap('ctrl', e, value)
				break
			case 'AltGraph':
				setMap('alt', e, value)
				break
			case 'Shift':
				setMap('shift', e, value)
				break
			case 'Meta':
				setMap('meta', e, value)
				break
			case 'ContextMenu':
				setMap('contextMenu', e, value)
				break
		}
	}

	// @ts-ignore
	window.keyboardModifiers = activeModifiers

	document.addEventListener('keydown', (e: KeyboardEvent) => {
		handleKeyEvent(e)
	})

	document.addEventListener('keyup', (e: KeyboardEvent) => {
		handleKeyEvent(e)
	})
}
