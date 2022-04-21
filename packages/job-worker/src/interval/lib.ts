/** Escape strings, so they are XML-compatible: **/
export function escapeHtml(text: string): string {
	const map: { [key: string]: string | undefined } = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;',
	}
	const nbsp = String.fromCharCode(160) // non-breaking space (160)
	map[nbsp] = ' ' // regular space

	const textLength = text.length
	let outText = ''
	for (let i = 0; i < textLength; i++) {
		const c = text[i]
		if (map[c]) {
			outText += map[c]
		} else {
			outText += c
		}
	}
	return outText
}
