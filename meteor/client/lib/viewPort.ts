import * as $ from 'jquery'

export function scrollToSegment (elementToScrollTo: HTMLElement | JQuery<HTMLElement>): boolean {
	const previousElement = $(elementToScrollTo).prev()
	const elementPosition = $(elementToScrollTo).offset()
	let scrollTop: number | null = null

	if (previousElement.length > 0) {
		const elementPosition = $(previousElement).offset()
		if (elementPosition) {
			scrollTop = elementPosition.top
		}
	} else if (elementPosition && (
		(elementPosition.top > ($('html,body').scrollTop() || 0) + window.innerHeight) ||
		(elementPosition.top < ($('html,body').scrollTop() || 0))
	)) {
		scrollTop = elementPosition.top
	}

	if (scrollTop !== null) {

		$(document.body).addClass('auto-scrolling')
		const autoScrolling = parseInt($(document.body).data('auto-scrolling') || 0, 10) + 1
		$(document.body).data('auto-scrolling', autoScrolling)
		$('html,body').animate({
			scrollTop: Math.max(0, scrollTop - 175)
		}, 400).promise().then(() => {
			// delay until next frame, so that the scroll handler can fire
			setTimeout(function () {
				const autoScrolling = parseInt($(document.body).data('auto-scrolling') || 0, 10) - 1
				$(document.body).data('auto-scrolling', autoScrolling)
				if (autoScrolling <= 0) {
					$(document.body).removeClass('auto-scrolling')
				}
			})
		})
		return true
	}
	return false
}
