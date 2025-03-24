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
	const [waitForInitialLoad, setWaitForInitialLoad] = useState(true)
	const [inView, setInView] = useState(initialShow ?? false)
	const [isShowingChildren, setIsShowingChildren] = useState(inView)

	const [measurements, setMeasurements] = useState<IElementMeasurements | null>(null)
	const [ref, setRef] = useState<HTMLDivElement | null>(null)

	const showPlaceholder = !isShowingChildren && !initialShow

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

	const onVisibleChanged = useCallback(
		(visible: boolean) => {
			const now = Date.now()

			// Debounce visibility changes in Safari to prevent unnecessary recaconditions
			if (SAFARI_VISIBILITY_DELAY > 0 && now - lastVisibilityChangeRef.current < SAFARI_VISIBILITY_DELAY) {
				return
			}

			lastVisibilityChangeRef.current = now

			setInView(visible)
		},
		[inView]
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
		if (inView === true) {
			setIsShowingChildren(true)

			// Schedule a measurement after a short delay
			if (waitForInitialLoad && ref) {
				const initialMeasurementTimeout = window.setTimeout(() => {
					const measurements = measureElement(ref)
					if (measurements) {
						setMeasurements(measurements)
						setWaitForInitialLoad(false)
					}
				}, 1000)

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
						const measurements = measureElement(ref)
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

function measureElement(wrapperEl: HTMLDivElement): IElementMeasurements | null {
	if (!wrapperEl || !wrapperEl.firstElementChild) {
		return null
	}

	const el = wrapperEl.firstElementChild as HTMLElement
	const style = window.getComputedStyle(el)

	// Look for the complete wrapper that contains both the timeline and dashboard
	const timelineWrapper = el.closest('.segment-timeline-wrapper--shelf')

	if (timelineWrapper) {
		// Check if the direct child of the wrapper has an explicit height set
		const wrapperChild = timelineWrapper.querySelector(':scope > div')
		let totalHeight = 0

		if (wrapperChild && wrapperChild instanceof HTMLElement) {
			// Check for explicit height style
			const inlineHeight = wrapperChild.style.height
			if (inlineHeight && inlineHeight.length > 0) {
				// Use the explicit height if it exists
				// Extract the numeric value if it's in pixels
				const heightValue = parseInt(inlineHeight, 10)
				if (!isNaN(heightValue)) {
					totalHeight = heightValue
				}
			}
		}

		// If no explicit height was found or it wasn't parseable, fall back to measuring
		if (totalHeight === 0) {
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
		clientHeight: el.clientHeight,
		marginTop: style.marginTop || undefined,
		marginBottom: style.marginBottom || undefined,
		marginLeft: style.marginLeft || undefined,
		marginRight: style.marginRight || undefined,
		id: el.id,
	}
}
