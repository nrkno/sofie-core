import { SEGMENT_TIMELINE_ELEMENT_ID } from '../ui/SegmentTimeline/SegmentTimeline'
import { isProtectedString } from './tempLib'
import RundownViewEventBus, { RundownViewEvents } from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { Settings } from '../lib/Settings'
import { PartId, PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIPartInstances, UIParts } from '../ui/Collections'
import { logger } from './logging'

const HEADER_MARGIN = 24 // TODOSYNC: TV2 uses 15. If it's needed to be different, it needs to be made generic somehow..
const FALLBACK_HEADER_HEIGHT = 65

let focusInterval: NodeJS.Timeout | undefined
let _dontClearInterval = false

export function maintainFocusOnPartInstance(
	partInstanceId: PartInstanceId,
	timeWindow: number,
	forceScroll?: boolean,
	noAnimation?: boolean
): void {
	const startTime = Date.now()
	const focus = () => {
		if (Date.now() - startTime < timeWindow) {
			_dontClearInterval = true
			scrollToPartInstance(partInstanceId, forceScroll, noAnimation)
				.then(() => {
					_dontClearInterval = false
				})
				.catch(() => {
					_dontClearInterval = false
				})
		} else {
			quitFocusOnPart()
		}
	}
	document.addEventListener('wheel', onWheelWhenMaintainingFocus, {
		once: true,
		capture: true,
		passive: true,
	})
	focusInterval = setInterval(focus, 500)
	focus()
}

export function isMaintainingFocus(): boolean {
	return !!focusInterval
}

function onWheelWhenMaintainingFocus() {
	quitFocusOnPart()
}

function quitFocusOnPart() {
	document.removeEventListener('wheel', onWheelWhenMaintainingFocus, {
		capture: true,
	})
	if (!_dontClearInterval && focusInterval) {
		clearInterval(focusInterval)
		focusInterval = undefined
	}
}

export async function scrollToPartInstance(
	partInstanceId: PartInstanceId,
	forceScroll?: boolean,
	noAnimation?: boolean
): Promise<boolean> {
	quitFocusOnPart()
	const partInstance = UIPartInstances.findOne(partInstanceId)
	if (partInstance) {
		RundownViewEventBus.emit(RundownViewEvents.GO_TO_PART_INSTANCE, {
			segmentId: partInstance.segmentId,
			partInstanceId: partInstanceId,
		})
		return scrollToSegment(partInstance.segmentId, forceScroll, noAnimation, partInstanceId)
	}
	throw new Error('Could not find PartInstance')
}

export async function scrollToPart(
	partId: PartId,
	forceScroll?: boolean,
	noAnimation?: boolean,
	zoomInToFit?: boolean
): Promise<boolean> {
	quitFocusOnPart()
	const part = UIParts.findOne(partId)
	if (part) {
		await scrollToSegment(part.segmentId, forceScroll, noAnimation)

		RundownViewEventBus.emit(RundownViewEvents.GO_TO_PART, {
			segmentId: part.segmentId,
			partId: partId,
			zoomInToFit,
		})

		return true // rather meaningless as we don't know what happened
	}
	throw new Error('Could not find part')
}

let HEADER_HEIGHT: number | undefined = undefined

export function getHeaderHeight(): number {
	if (HEADER_HEIGHT === undefined) {
		const root = document.querySelector('#render-target > .container-fluid > .rundown-view > .header')
		if (!root) {
			return FALLBACK_HEADER_HEIGHT
		}
		const { height } = root.getBoundingClientRect()
		HEADER_HEIGHT = height
	}
	return HEADER_HEIGHT
}

let pendingSecondStageScroll: number | undefined
let currentScrollingElement: HTMLElement | undefined

export async function scrollToSegment(
	elementToScrollToOrSegmentId: HTMLElement | SegmentId,
	forceScroll?: boolean,
	noAnimation?: boolean,
	partInstanceId?: PartInstanceId | undefined
): Promise<boolean> {
	const getElementToScrollTo = (showHistory: boolean): HTMLElement | null => {
		if (isProtectedString(elementToScrollToOrSegmentId)) {
			let targetElement = document.querySelector<HTMLElement>(
				`#${SEGMENT_TIMELINE_ELEMENT_ID}${elementToScrollToOrSegmentId}`
			)

			if (showHistory && Settings.followOnAirSegmentsHistory && targetElement) {
				let i = Settings.followOnAirSegmentsHistory
				while (i > 0) {
					// Segment timeline is wrapped by <div><div>...</div></div> when rendered
					const next: any = targetElement?.parentElement?.parentElement?.previousElementSibling?.children
						.item(0)
						?.children.item(0)
					if (next) {
						targetElement = next
						i--
					} else {
						i = 0
					}
				}
			}

			return targetElement
		}

		return elementToScrollToOrSegmentId
	}

	const elementToScrollTo: HTMLElement | null = getElementToScrollTo(false)
	const historyTarget: HTMLElement | null = getElementToScrollTo(true)

	// historyTarget will be === to elementToScrollTo if history is not used / not found
	if (!elementToScrollTo || !historyTarget) {
		throw new Error('Could not find segment element')
	}

	return innerScrollToSegment(
		historyTarget,
		forceScroll || !regionInViewport(historyTarget, elementToScrollTo),
		noAnimation,
		false,
		partInstanceId
	)
}

async function innerScrollToSegment(
	elementToScrollTo: HTMLElement,
	forceScroll?: boolean,
	noAnimation?: boolean,
	secondStage?: boolean,
	partInstanceId?: PartInstanceId | undefined
): Promise<boolean> {
	if (!secondStage) {
		currentScrollingElement = elementToScrollTo
	} else if (secondStage && elementToScrollTo !== currentScrollingElement) {
		throw new Error('Scroll overriden by another scroll')
	}

	let { top, bottom } = elementToScrollTo.getBoundingClientRect()
	top = Math.floor(top)
	bottom = Math.floor(bottom)

	const headerHeight = Math.floor(getHeaderHeight())

	// check if the item is in viewport
	if (forceScroll || bottom > Math.floor(window.innerHeight) || top < headerHeight) {
		if (pendingSecondStageScroll) window.cancelIdleCallback(pendingSecondStageScroll)

		return scrollToPosition(top + window.scrollY, noAnimation).then(
			async () => {
				// retry scroll in case we have to load some data
				if (pendingSecondStageScroll) window.cancelIdleCallback(pendingSecondStageScroll)
				return new Promise<boolean>((resolve, reject) => {
					// scrollToPosition will resolve after some time, at which point a new pendingSecondStageScroll may have been created

					pendingSecondStageScroll = window.requestIdleCallback(
						() => {
							if (!secondStage) {
								let { top, bottom } = elementToScrollTo.getBoundingClientRect()
								top = Math.floor(top)
								bottom = Math.floor(bottom)

								if (bottom > Math.floor(window.innerHeight) || top < headerHeight) {
									innerScrollToSegment(
										elementToScrollTo,
										forceScroll,
										true,
										true,
										partInstanceId
									).then(resolve, reject)
								} else {
									resolve(true)
								}
							} else {
								currentScrollingElement = undefined
								resolve(true)
							}
						},
						{ timeout: 250 }
					)
				})
			},
			(error) => {
				if (!error.toString().match(/another scroll/)) logger.error(error)
				return false
			}
		)
	}

	return Promise.resolve(false)
}

function regionInViewport(topElement: HTMLElement, bottomElement: HTMLElement) {
	const { top, bottom } = getRegionPosition(topElement, bottomElement)

	const headerHeight = Math.floor(getHeaderHeight())

	return !(bottom > Math.floor(window.innerHeight) || top < headerHeight)
}

function getRegionPosition(topElement: HTMLElement, bottomElement: HTMLElement): { top: number; bottom: number } {
	let top = topElement.getBoundingClientRect().top
	let bottom = bottomElement.getBoundingClientRect().bottom
	top = Math.floor(top)
	bottom = Math.floor(bottom)

	return { top, bottom }
}

let scrollToPositionRequest: number | undefined
let scrollToPositionRequestReject: ((reason?: any) => void) | undefined

export async function scrollToPosition(scrollPosition: number, noAnimation?: boolean): Promise<void> {
	if (noAnimation) {
		window.scroll({
			top: Math.max(0, scrollPosition - getHeaderHeight() - HEADER_MARGIN),
			left: 0,
		})
		return Promise.resolve()
	} else {
		return new Promise((resolve, reject) => {
			if (scrollToPositionRequest !== undefined) window.cancelIdleCallback(scrollToPositionRequest)
			if (scrollToPositionRequestReject !== undefined)
				scrollToPositionRequestReject('Prevented by another scroll')

			scrollToPositionRequestReject = reject
			const currentTop = window.scrollY
			const targetTop = Math.max(0, scrollPosition - getHeaderHeight() - HEADER_MARGIN)
			scrollToPositionRequest = window.requestIdleCallback(
				() => {
					window.scroll({
						top: targetTop,
						left: 0,
						behavior: 'smooth',
					})
					setTimeout(() => {
						resolve()
						scrollToPositionRequestReject = undefined
						// this formula was experimentally created from Chrome 86 behavior
					}, 3000 * Math.log(Math.abs(currentTop - targetTop) / 2000 + 1))
				},
				{ timeout: 250 }
			)
		})
	}
}

let pointerLockTurnstile = 0
let pointerHandlerAttached = false

function pointerLockChange(_e: Event): void {
	if (!document.pointerLockElement) {
		// noOp, if the pointer is unlocked, good. That's a safe position
		return
	}

	// if a pointer has been locked, check if it should be. We might have already
	// changed our mind
	if (pointerLockTurnstile <= 0) {
		// this means that the we've received an equal amount of locks and unlocks (or even more unlocks)
		// we should request an exit from the pointer lock
		pointerLockTurnstile = 0
		document.exitPointerLock()
	}
}

function pointerLockError(e: Event): void {
	console.log('Pointer lock error', e)
	pointerLockTurnstile = 0
}

export function lockPointer(): void {
	if (pointerLockTurnstile === 0) {
		// pointerLockTurnstile === 0 means that no requests for locking the pointer have been made
		// since we last unlocked it
		document.body.requestPointerLock()
		// attach the event handlers only once. Once they are attached, we will track the
		// locked state and act according to the turnstile
		if (!pointerHandlerAttached) {
			pointerHandlerAttached = true
			document.addEventListener('pointerlockchange', pointerLockChange)
			document.addEventListener('pointerlockerror', pointerLockError)
		}
	}
	// regardless of any other state, modify the turnstile so that we can track locks/unlocks
	pointerLockTurnstile++
}

export function unlockPointer(): void {
	// request and exit, but bear in mind that this might not actually
	// cause an exit, for timing reasons, so lets modify the turnstile
	// to be able to act, once the lock is confirmed
	document.exitPointerLock()
	pointerLockTurnstile--
}
