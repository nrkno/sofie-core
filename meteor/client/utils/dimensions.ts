export function getElementWidth(element: HTMLElement): number {
	const computedWidth = Number(window.getComputedStyle(element).width)

	return Number.isNaN(computedWidth) ? element.offsetWidth : computedWidth
}
