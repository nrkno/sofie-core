export namespace mousetrapHelper {
	export function shortcutLabel(hotkey: string, isMacLike: boolean = false): string {
		if (isMacLike) {
			hotkey = hotkey.replace(/mod/i, '\u2318')
		} else {
			hotkey = hotkey.replace(/mod/i, 'Ctrl')
		}
		// capitalize first letter of each combo key
		hotkey = hotkey
			.replace(/(\w)\w*/gi, (substring: string) => {
				return substring.substr(0, 1).toUpperCase() + substring.substr(1).toLowerCase()
			})
			.replace(/(\s*,\s*)/g, () => {
				return ', '
			})

		return hotkey
	}
}
