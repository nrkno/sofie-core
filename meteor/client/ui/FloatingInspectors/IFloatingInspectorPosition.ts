import { VirtualElement } from '@popperjs/core'
import React, { useMemo, useEffect, useRef } from 'react'
import { usePopper } from 'react-popper'
import { getHeaderHeight } from '../../lib/viewPort'

export interface IFloatingInspectorPosition {
	top: number
	left: number
	position: 'top' | 'bottom'
	anchor: 'start' | 'center' | 'end'
}

const LAYER_HEIGHT = 24

export function useInspectorPosition(
	position: IFloatingInspectorPosition,
	inspectorEl: HTMLElement | null
): React.CSSProperties | undefined {
	const positionRef = useRef({
		...position,
	})

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

	const { styles, update } = usePopper(virtualElement, inspectorEl, {
		placement: position.position,
		modifiers: [
			{
				name: 'flip',
				options: {
					padding: { top: getHeaderHeight() - 10 },
					fallbackPlacements: ['bottom', 'top'],
				},
			},
			{
				name: 'preventOverflow',
				options: {
					mainAxis: true,
				},
			},
			{
				name: 'offset',
				options: {
					offset: [0, 8],
				},
			},
		],
	})

	useEffect(() => {
		if (update) update().catch(console.error)
	}, [update, position])

	return styles.popper
}
