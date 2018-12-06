import * as $ from 'jquery'
import * as _ from 'underscore'
import { SegmentTimelineElementId } from '../ui/SegmentTimeline/SegmentTimeline'
import { SegmentLines } from '../../lib/collections/SegmentLines'

export function scrollToSegmentLine (segmentLineId: string): boolean {
	// TODO: do scrolling within segment as well?

	let segmentLine = SegmentLines.findOne(segmentLineId)
	if (segmentLine) {
		return scrollToSegment(segmentLine.segmentId)
	}
	return false
}

const HEADER_HEIGHT = 175

export function scrollToSegment ( elementToScrollToOrSegmentId: HTMLElement | JQuery<HTMLElement> | string, forceScroll?: boolean): boolean {

	let elementToScrollTo: HTMLElement | JQuery<HTMLElement> = (
		_.isString(elementToScrollToOrSegmentId) ?
		$('#' + SegmentTimelineElementId + elementToScrollToOrSegmentId) :
		elementToScrollToOrSegmentId
	)
	const elementPosition = $(elementToScrollTo).offset()
	const elementHeight = $(elementToScrollTo).height() || 0
	let scrollTop: number | null = null


	// check if the item is in viewport
	if (elementPosition && ((
		(elementPosition.top + elementHeight > ($('html,body').scrollTop() || 0) + window.innerHeight) ||
		(elementPosition.top < ($('html,body').scrollTop() || 0))
	) || forceScroll)) {
		scrollTop = elementPosition.top
	}
	if (scrollTop !== null) {
		scrollToPosition(scrollTop)
		return true
	}
	return false
}

export function scrollToPosition ( scrollPosition: number): void {
	$(document.body).addClass('auto-scrolling')
	const autoScrolling = parseInt($(document.body).data('auto-scrolling') || 0, 10) + 1
	$(document.body).data('auto-scrolling', autoScrolling)
	$('html,body').animate({
		scrollTop: Math.max(0, scrollPosition - HEADER_HEIGHT)
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
}
