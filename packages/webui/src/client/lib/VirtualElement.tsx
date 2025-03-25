import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { InView } from 'react-intersection-observer'
import { getViewPortScrollingState } from './viewPort'

interface IElementMeasurements {
	width: string | number
	clientHeight: number
	marginLeft: string | number | undefined
	marginRight: string | number | undefined
	marginTop: string | number | undefined
	marginBottom: string | number | undefined
	id: string | undefined
}

const IDLE_CALLBACK_TIMEOUT = 100
// Increased delay for Safari, as Safari doesn't have scroll time when using 'smooth' scroll
const SAFARI_VISIBILITY_DELAY = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ? 100 : 0

/**
 * This is a component that allows optimizing the amount of elements present in the DOM through replacing them
 * with placeholders when they aren't visible in the viewport.
 * Scroll timing issues, should be handled in viewPort.tsx where the scrolling state is tracked.
 *
 * @export
 * @param {(React.PropsWithChildren<{
 * 	initialShow?: boolean
 * 	placeholderHeight?: number
 * 	_debug?: boolean
 * 	placeholderClassName?: string
 * 	width?: string | number
 * 	margin?: string
 * 	id?: string | undefined
 * 	className?: string
 * }>)} {
 * 	initialShow,
 * 	placeholderHeight,
 * 	placeholderClassName,
 * 	width,
 * 	margin,
 * 	id,
 * 	className,
 * 	children,
 * }
 * @return {*}  {(JSX.Element | null)}
 */

export function VirtualElement({
	initialShow,
	placeholderHeight,
	placeholderClassName,
	width,
	margin,
	id,
	className,
	children,
}: React.PropsWithChildren<{
	initialShow?: boolean
	placeholderHeight?: number
	_debug?: boolean
	placeholderClassName?: string
	width?: string | number
	margin?: string
	id?: string | undefined
	className?: string
}>): JSX.Element | null {
	const resizeObserverManager = ResizeObserverManager.getInstance()
	const [waitForInitialLoad, setWaitForInitialLoad] = useState(true)
	const [inView, setInView] = useState(initialShow ?? false)
	const [isShowingChildren, setIsShowingChildren] = useState(inView)

	const [measurements, setMeasurements] = useState<IElementMeasurements | null>(null)
	const [ref, setRef] = useState<HTMLDivElement | null>(null)

	let inViewChangetimer: NodeJS.Timeout | undefined

	const showPlaceholder = !isShowingChildren && !initialShow

	const isCurrentlyObserving = useRef(false)
	const isTransitioning = useRef(false)

	// Track the last visibility change to debounce
	const lastVisibilityChangeRef = useRef<number>(0)

	const styleObj = useMemo<React.CSSProperties>(
		() => ({
			width: width ?? 'auto',
			height: (placeholderHeight ?? '0') + 'px',
			marginTop: 0,
			marginLeft: 0,
			marginRight: 0,
			marginBottom: 0,
			// These properties are used to ensure that if a prior element is changed from
			// placeHolder to element, the position of visible elements are not affected.
			contentVisibility: 'auto',
			containIntrinsicSize: `0 ${placeholderHeight ?? '0'}px`,
			contain: 'size layout',
		}),
		[width, placeholderHeight]
	)

	const handleResize = useCallback(() => {
		if (ref) {
			// Show children during measurement
			setIsShowingChildren(true)

			requestAnimationFrame(() => {
				const measurements = measureElement(ref, placeholderHeight)
				if (measurements) {
					setMeasurements(measurements)

					// Only hide children again if not in view
					if (!inView && measurements.clientHeight > 0) {
						setIsShowingChildren(false)
					} else {
						setIsShowingChildren(true)
					}
				}
			})
		}
	}, [ref, inView, placeholderHeight])

	const onVisibleChanged = useCallback(
		(visible: boolean) => {
			const now = Date.now()

			// Debounce visibility changes in Safari to prevent unnecessary recaconditions
			if (SAFARI_VISIBILITY_DELAY > 0 && now - lastVisibilityChangeRef.current < SAFARI_VISIBILITY_DELAY) {
				return
			}

			lastVisibilityChangeRef.current = now
			if (inView === visible) {
				return
			}

			setInView(visible)

			// Don't do updates while transitioning:
			if (isTransitioning.current) {
				return
			}
			isTransitioning.current = true

			// Clear any existing timers
			if (inViewChangetimer) {
				clearTimeout(inViewChangetimer)
			}

			// Delay the observer connection to prevent flickering
			inViewChangetimer = setTimeout(() => {
				if (visible) {
					if (ref) {
						if (!isCurrentlyObserving.current) {
							resizeObserverManager.observe(ref, handleResize)
							isCurrentlyObserving.current = true
						}
					}
				}
				isTransitioning.current = false
			}, 100)
		},
		[ref]
	)

	const isScrolling = (): boolean => {
		// Don't do updates while scrolling:
		if (getViewPortScrollingState().isProgrammaticScrollInProgress) {
			return true
		}
		// And wait if a programmatic scroll was done recently:
		const timeSinceLastProgrammaticScroll = Date.now() - getViewPortScrollingState().lastProgrammaticScrollTime
		if (timeSinceLastProgrammaticScroll < 100) {
			return true
		}
		return false
	}

	useEffect(() => {
		// Setup initial observer if element is in view
		if (ref && inView && !isCurrentlyObserving.current) {
			resizeObserverManager.observe(ref, handleResize)
			isCurrentlyObserving.current = true
		}

		// Cleanup function
		return () => {
			// Clean up resize observer
			if (ref && isCurrentlyObserving.current) {
				resizeObserverManager.unobserve(ref)
				isCurrentlyObserving.current = false
			}

			if (inViewChangetimer) {
				clearTimeout(inViewChangetimer)
			}
		}
	}, [ref, inView])

	useEffect(() => {
		if (inView === true) {
			setIsShowingChildren(true)

			// Schedule a measurement after a short delay
			if (waitForInitialLoad && ref) {
				const initialMeasurementTimeout = window.setTimeout(() => {
					const measurements = measureElement(ref, placeholderHeight)
					if (measurements) {
						setMeasurements(measurements)
						setWaitForInitialLoad(false)
					}
				}, 800)

				return () => {
					window.clearTimeout(initialMeasurementTimeout)
				}
			}
			return
		}

		let idleCallback: number | undefined
		let optimizeTimeout: number | undefined

		const scheduleOptimization = () => {
			if (optimizeTimeout) {
				window.clearTimeout(optimizeTimeout)
			}
			// Don't proceed if we're scrolling
			if (isScrolling()) {
				// Reschedule for after the scroll should be complete
				const scrollDelay = 400
				window.clearTimeout(optimizeTimeout)
				optimizeTimeout = window.setTimeout(scheduleOptimization, scrollDelay)
				return
			}
			idleCallback = window.requestIdleCallback(
				() => {
					// Measure the entire wrapper element instead of just the childRef
					if (ref) {
						const measurements = measureElement(ref, placeholderHeight)
						if (measurements) {
							setMeasurements(measurements)
						}
					}
					setIsShowingChildren(false)
				},
				{
					timeout: IDLE_CALLBACK_TIMEOUT,
				}
			)
		}

		// Schedule the optimization:
		scheduleOptimization()

		return () => {
			if (idleCallback) {
				window.cancelIdleCallback(idleCallback)
			}
			if (optimizeTimeout) {
				window.clearTimeout(optimizeTimeout)
			}
		}
	}, [ref, inView])

	return (
		<InView
			threshold={0}
			rootMargin={margin || '50% 0px 50% 0px'}
			onChange={onVisibleChanged}
			className={className}
			as="div"
		>
			<div
				ref={setRef}
				style={
					// We need to set undefined if the height is not known, to allow the parent to calculate the height
					measurements
						? {
								height: measurements.clientHeight + 'px',
						  }
						: undefined
				}
			>
				{showPlaceholder ? (
					<div
						id={measurements?.id ?? id}
						className={`virtual-element-placeholder ${placeholderClassName}`}
						style={styleObj}
					></div>
				) : (
					children
				)}
			</div>
		</InView>
	)
}
function measureElement(wrapperEl: HTMLDivElement, placeholderHeight?: number): IElementMeasurements | null {
	if (!wrapperEl || !wrapperEl.firstElementChild) {
		return null
	}

	const el = wrapperEl.firstElementChild as HTMLElement
	const style = window.getComputedStyle(el)

	const timelineWrapper = el.closest('.segment-timeline-wrapper--shelf')

	if (timelineWrapper) {
		let totalHeight = 0

		// Get the segment timeline height
		const segmentTimeline = timelineWrapper.querySelector('.segment-timeline')
		if (segmentTimeline) {
			const segmentRect = segmentTimeline.getBoundingClientRect()
			totalHeight = segmentRect.height
		}

		// Add the dashboard panel height if it exists
		const dashboardPanel = timelineWrapper.querySelector('.dashboard-panel')
		if (dashboardPanel) {
			const panelRect = dashboardPanel.getBoundingClientRect()
			totalHeight += panelRect.height
		}

		if (totalHeight < 40) {
			totalHeight = placeholderHeight ?? el.clientHeight
		}

		return {
			width: style.width || 'auto',
			clientHeight: totalHeight,
			marginTop: style.marginTop || undefined,
			marginBottom: style.marginBottom || undefined,
			marginLeft: style.marginLeft || undefined,
			marginRight: style.marginRight || undefined,
			id: el.id,
		}
	}

	// Fallback to just measuring the element itself if wrapper isn't found
	return {
		width: style.width || 'auto',
		clientHeight: placeholderHeight ?? el.clientHeight,
		marginTop: style.marginTop || undefined,
		marginBottom: style.marginBottom || undefined,
		marginLeft: style.marginLeft || undefined,
		marginRight: style.marginRight || undefined,
		id: el.id,
	}
}

// Singleton class to manage ResizeObserver instances
export class ResizeObserverManager {
	private static instance: ResizeObserverManager
	private resizeObserver: ResizeObserver
	private observedElements: Map<HTMLElement, (entry: ResizeObserverEntry) => void>

	private constructor() {
		this.observedElements = new Map()
		this.resizeObserver = new ResizeObserver((entries) => {
			entries.forEach((entry) => {
				const element = entry.target as HTMLElement
				const callback = this.observedElements.get(element)
				if (callback) {
					callback(entry)
				}
			})
		})
	}

	public static getInstance(): ResizeObserverManager {
		if (!ResizeObserverManager.instance) {
			ResizeObserverManager.instance = new ResizeObserverManager()
		}
		return ResizeObserverManager.instance
	}

	public observe(element: HTMLElement, callback: (entry: ResizeObserverEntry) => void): void {
		if (!element) return

		// Store the callback in our map
		this.observedElements.set(element, callback)

		// Start observing
		this.resizeObserver.observe(element)
	}

	public unobserve(element: HTMLElement): void {
		if (!element) return

		// Remove from our map
		this.observedElements.delete(element)

		// Stop observing
		this.resizeObserver.unobserve(element)
	}
}
