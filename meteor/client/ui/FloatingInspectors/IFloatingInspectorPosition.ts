import { VirtualElement } from '@popperjs/core'
import React, { useMemo } from 'react'
import { usePopper } from 'react-popper'

export interface IFloatingInspectorPosition {
	top: number
	left: number
	position: 'top' | 'bottom'
	anchor: 'start' | 'center' | 'end'
}

export function useInspectorPosition(
	position: IFloatingInspectorPosition,
	visible: boolean,
	displayOn?: 'document' | 'viewport',
	el?: HTMLElement | null | undefined
): React.CSSProperties | undefined {
	// const [viewportRect, setViewportRect] = useState<IRect | null>(null)
	// const [elRect, setElRect] = useState<IRect | null>(null)

	// useLayoutEffect(() => {
	// 	if (!visible) return

	// 	setViewportRect({
	// 		top: window.scrollY,
	// 		left: window.scrollY,
	// 		width: window.innerWidth,
	// 		height: window.innerHeight,
	// 	})
	// }, [visible])

	// useLayoutEffect(() => {
	//     if (!el) return

	//     const rect = el.getBoundingClientRect()
	//     setElRect({
	//         top: rect.top,
	//         left: rect.left,
	//         height: rect.height,
	//         width: rect.width,
	//     })
	// }, [el])

	// const result = useMemo<React.CSSProperties | undefined>(() => {
	// 	if (!visible) return undefined

	// 	return {
	// 		top: position.top + 'px',
	// 		left: position.left + 'px',
	// 		transform: 'translate(0, -100%)',
	// 	}
	// }, [position, visible, viewportRect, displayOn])

	const virtualElement = useMemo<VirtualElement>(() => {
		return {
			getBoundingClientRect: (): DOMRect => ({
				top: position.top ?? 0,
				left: position.left ?? 0,
				width: 0,
				height: 0,
				right: position.left ?? 0,
				bottom: position.top ?? 0,
				x: position.left ?? 0,
				y: position.top ?? 0,
				toJSON: () => '',
			}),
		}
	}, [position])

	const { styles } = usePopper(virtualElement, el, {
		placement: position.position,
	})

	return styles
}
