export { setSelected, clearSelected, getSelected }

let selected = null

function setSelected(clip) {
	if (clip) {
		selected = clip
	}
}

function clearSelected() {
	const cleared = selected
	selected = null

	return cleared
}

function getSelected() {
	return selected
}
