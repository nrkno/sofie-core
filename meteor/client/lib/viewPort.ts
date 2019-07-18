import * as _ from 'underscore'
import * as Velocity from 'velocity-animate'

import { SEGMENT_TIMELINE_ELEMENT_ID } from '../ui/SegmentTimeline/SegmentTimeline'
import { Parts } from '../../lib/collections/Parts'

export function scrollToPart(partId: string): Promise<boolean> {
	// TODO: do scrolling within segment as well?

	let part = Parts.findOne(partId)
	if (part) {
		return scrollToSegment(part.segmentId)
	}
	return Promise.reject('Could not find part');
}

const HEADER_HEIGHT = 175

export function scrollToSegment(elementToScrollToOrSegmentId: HTMLElement | string, forceScroll?: boolean): Promise<boolean> {
	let elementToScrollTo: HTMLElement | null = (
		_.isString(elementToScrollToOrSegmentId) ?
			document.querySelector('#' + SEGMENT_TIMELINE_ELEMENT_ID + elementToScrollToOrSegmentId) :
			elementToScrollToOrSegmentId
	)

	if (!elementToScrollTo) {
		return Promise.reject('Could not find segment element');
	}

	let { top, bottom } = elementToScrollTo.getBoundingClientRect()
	top += window.scrollY
	bottom += window.scrollY

	// check if the item is in viewport
	if (forceScroll ||
		bottom > window.scrollY + window.innerHeight ||
		top < window.scrollY) {

		return scrollToPosition(top).then(() => true)
	}

	return Promise.resolve(false)
}

export function scrollToPosition(scrollPosition: number): Promise<void> {
	document.body.classList.add('auto-scrolling')
	const autoScrolling = document.body.dataset.autoScrolling ? parseInt(document.body.dataset.autoScrolling, 10) + 1 : 1
	document.body.dataset.autoScrolling = String(autoScrolling)
	return new Promise((resolve, reject) => {
		Velocity(document.documentElement, 'scroll', {
			offset: Math.max(0, scrollPosition - HEADER_HEIGHT),
			mobileHA: false,
			duration: 400
		}).then(() => {
			// delay until next frame, so that the scroll handler can fire
			const autoScrolling = document.body.dataset.autoScrolling ? parseInt(document.body.dataset.autoScrolling, 10) - 1 : -1
			document.body.dataset.autoScrolling = String(autoScrolling)
			if (autoScrolling <= 0) {
				document.body.classList.remove('auto-scrolling')
			}
			setTimeout(() => resolve())
		})
	})
}
