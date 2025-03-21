import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react'
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
	const [inView, setInView] = useState(initialShow ?? false)
	const [isShowingChildren, setIsShowingChildren] = useState(inView)
	const [measurements, setMeasurements] = useState<IElementMeasurements | null>(null)
	const [ref, setRef] = useState<HTMLDivElement | null>(null)
	const [childRef, setChildRef] = useState<HTMLElement | null>(null)

	// Track the last visibility change to debounce
	const lastVisibilityChangeRef = useRef<number>(0)

	const isMeasured = !!measurements

	const styleObj = useMemo<React.CSSProperties>(
		() => ({
			width: width ?? measurements?.width ?? 'auto',
			height: (measurements?.clientHeight ?? placeholderHeight ?? '0') + 'px',
			marginTop: measurements?.marginTop,
			marginLeft: measurements?.marginLeft,
			marginRight: measurements?.marginRight,
			marginBottom: measurements?.marginBottom,
			// These properties are used to ensure that if a prior element is changed from
			// placeHolder to element, the position of visible elements are not affected.
			contentVisibility: 'auto',
			containIntrinsicSize: `0 ${measurements?.clientHeight ?? placeholderHeight ?? '0'}px`,
			contain: 'size layout',
		}),
		[width, measurements, placeholderHeight]
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
					if (childRef) {
						setMeasurements(measureElement(childRef))
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
	}, [childRef, inView, measurements])

	const showPlaceholder = !isShowingChildren && (!initialShow || isMeasured)

	useLayoutEffect(() => {
		if (!ref || showPlaceholder) return

		const el = ref?.firstElementChild
		if (!el || el.classList.contains('virtual-element-placeholder') || !(el instanceof HTMLElement)) return

		setChildRef(el)

		let idleCallback: number | undefined
		const refreshSizingTimeout = window.setTimeout(() => {
			idleCallback = window.requestIdleCallback(
				() => {
					const newMeasurements = measureElement(el)
					setMeasurements(newMeasurements)

					// Set CSS variable for expected height on parent element
					if (ref && newMeasurements) {
						ref.style.setProperty('--expected-height', `${newMeasurements.clientHeight}px`)
					}
				},
				{
					timeout: IDLE_CALLBACK_TIMEOUT,
				}
			)
		}, 1000)

		return () => {
			if (idleCallback) {
				window.cancelIdleCallback(idleCallback)
			}
			window.clearTimeout(refreshSizingTimeout)
		}
	}, [ref, showPlaceholder, measurements])

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

function measureElement(el: HTMLElement): IElementMeasurements | null {
	const style = window.getComputedStyle(el)

	// Get children to be measured
	const segmentTimeline = el.querySelector('.segment-timeline')
	const dashboardPanel = el.querySelector('.rundown-view-shelf.dashboard-panel')

	if (!segmentTimeline) return null

	// Segment height
	const segmentRect = segmentTimeline.getBoundingClientRect()
	let totalHeight = segmentRect.height

	// Dashboard panel height if present
	if (dashboardPanel) {
		const panelRect = dashboardPanel.getBoundingClientRect()
		totalHeight += panelRect.height
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
