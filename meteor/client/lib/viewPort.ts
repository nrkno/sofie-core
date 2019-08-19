import * as _ from 'underscore'
import * as Velocity from 'velocity-animate'

import { SegmentTimelineElementId } from '../ui/SegmentTimeline/SegmentTimeline'
import { Parts } from '../../lib/collections/Parts'

export function scrollToPart(partId: string): boolean {
	// TODO: do scrolling within segment as well?

	let part = Parts.findOne(partId)
	if (part) {
		return scrollToSegment(part.segmentId)
	}
	return false
}

const HEADER_HEIGHT = 175

export function scrollToSegment(elementToScrollToOrSegmentId: HTMLElement | string, forceScroll?: boolean): boolean {
	let elementToScrollTo: HTMLElement | null = (
		_.isString(elementToScrollToOrSegmentId) ?
			document.querySelector('#' + SegmentTimelineElementId + elementToScrollToOrSegmentId) :
			elementToScrollToOrSegmentId
	)

	if (!elementToScrollTo) {
		return false;
	}

	const { top, bottom } = elementToScrollTo.getBoundingClientRect()

	// check if the item is in viewport
	if (forceScroll ||
		bottom > window.innerHeight ||
		top < HEADER_HEIGHT) {

		scrollToPosition(document.documentElement.scrollTop + top)
		return true
	}

	return false
}

export function scrollToPosition(scrollPosition: number): void {
	document.body.classList.add('auto-scrolling')
	const autoScrolling = document.body.dataset.autoScrolling ? parseInt(document.body.dataset.autoScrolling, 10) + 1 : 1
	document.body.dataset.autoScrolling = String(autoScrolling)
	// TODO: R12 has better code to handle this, but there are breaking changes, so be careful if/when merging
	Velocity(document.documentElement, 'scroll', {
		offset: Math.max(0, scrollPosition - HEADER_HEIGHT),
		duration: 400,
		queue: false
	}).then(() => {
		// delay until next frame, so that the scroll handler can fire
		requestAnimationFrame(function () {
			const autoScrolling = document.body.dataset.autoScrolling ? parseInt(document.body.dataset.autoScrolling, 10) - 1 : -1
			document.body.dataset.autoScrolling = String(autoScrolling)
			if (autoScrolling <= 0) {
				document.body.classList.remove('auto-scrolling')
			}
		})
	})
}
