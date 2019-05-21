export function getElementWidth(element: HTMLElement): number {
	const computedWidth = Number(window.getComputedStyle(element).width)

	return Number.isNaN(computedWidth) ? element.offsetWidth : computedWidth
}

/**
 * Replicates the behavior of jQuery's height() function. Note that it's only
 * really needed to get the height **excluding padding** for inline elements.
 * For all other use cases there are properties on the Element itself 
 * that can be read directly or via window.getComputedStyle.
 * 
 * @param element - the element to calculate height for
 * @returns the calculated height of the element excluding padding
 */
export function getElementHeight(element: HTMLElement): number {
	const { height, paddingTop, paddingBottom } = window.getComputedStyle(element)
	const computedHeight = Number(height)

	if (!Number.isNaN(computedHeight)) {
		return computedHeight
	}

	const computedPaddingTop = paddingTop ? Number.parseInt(paddingTop, 10) : 0
	const computedPaddingBottom = paddingBottom ? Number.parseInt(paddingBottom, 10) : 0

	return element.scrollHeight - computedPaddingTop - computedPaddingBottom
}
