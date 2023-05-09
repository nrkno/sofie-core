import { VirtualElement } from '@popperjs/core'
import React, { useMemo, useEffect, useRef, RefObject, useLayoutEffect, useState } from 'react'
import { usePopper } from 'react-popper'
import { getHeaderHeight } from '../../lib/viewPort'

export function useInspectorPosition(
	position: IFloatingInspectorPosition,
	inspectorEl: RefObject<HTMLElement>,
	shown: boolean = true
): React.CSSProperties | undefined {
	const [, forceUpdate] = useState(Symbol())

	const positionRef = useRef({
		...position,
	})

	const popperModifiers = useMemo(() => {
		let fallbackPlacements = ['bottom', 'top']

		if (position.position === 'bottom-start' || position.position === 'top-start') {
			fallbackPlacements = ['bottom-start', 'top-start']
		} else if (position.position === 'bottom-end' || position.position === 'top-end') {
			fallbackPlacements = ['bottom-end', 'top-end']
		}

		return [
			{
				name: 'flip',
				options: {
					padding: { top: getHeaderHeight() - 10 },
					fallbackPlacements,
				},
			},
			{
				name: 'preventOverflow',
				options: {
					padding: { right: 70 },
				},
			},
			{
				name: 'offset',
				options: {
					offset: [0, 8],
				},
			},
		]
	}, [position.position])

	const virtualElement = useMemo<VirtualElement>(() => {
		return {
			getBoundingClientRect: (): DOMRect => {
				const top = (positionRef.current.top ?? 0) - window.scrollY
				const left = (positionRef.current.left ?? 0) - window.scrollX
				const right = left
				const bottom = top - LAYER_HEIGHT
				const x = left
				const y = top
				return {
					top,
					left,
					width: 0,
					height: LAYER_HEIGHT,
					right,
					bottom,
					x,
					y,
					toJSON: () => '',
				}
			},
		}
	}, [])

	useEffect(() => {
		positionRef.current = {
			...position,
		}
	}, [position])

	const { styles, update } = usePopper(virtualElement, inspectorEl.current, {
		placement: position.position,
		modifiers: popperModifiers,
	})

	useEffect(() => {
		if (update) {
			update().catch(console.error)
		}
	}, [update, position])

	useLayoutEffect(() => {
		const timeout = setTimeout(() => {
			forceUpdate(Symbol())
		}, 10)

		return () => {
			clearTimeout(timeout)
		}
	}, [shown])

	return styles.popper
}

export interface IFloatingInspectorPosition {
	top: number
	left: number
	position: 'top' | 'bottom' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'
	anchor: 'start' | 'center' | 'end'
}

const LAYER_HEIGHT = 24
