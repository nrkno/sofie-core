import { VirtualElement } from '@popperjs/core'
import React, { useMemo, useEffect, useRef } from 'react'
import { usePopper } from 'react-popper'

export interface IFloatingInspectorPosition {
	top: number
	left: number
	position: 'top' | 'bottom'
	anchor: 'start' | 'center' | 'end'
}

export function useInspectorPosition(
	position: IFloatingInspectorPosition,
	el?: HTMLElement | null | undefined
): React.CSSProperties | undefined {
	const positionRef = useRef({
		...position,
	})

	const virtualElement = useMemo<VirtualElement>(() => {
		return {
			getBoundingClientRect: (): DOMRect => {
				console.log('getBoundingClientRect')
				return {
					top: positionRef.current.top ?? 0,
					left: positionRef.current.left ?? 0,
					width: 0,
					height: 0,
					right: positionRef.current.left ?? 0,
					bottom: positionRef.current.top ?? 0,
					x: positionRef.current.left ?? 0,
					y: positionRef.current.top ?? 0,
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

	const { styles, update } = usePopper(virtualElement, el, {
		placement: position.position,
	})

	useEffect(() => {
		if (update) update().catch(console.error)
	}, [update, position])

	console.log(styles.popper, position)

	return styles.popper
}
