import React, { useEffect, useMemo, useState } from 'react'

export interface IFloatingInspectorPosition {
	top?: number
	left?: number
	right?: number
	bottom?: number
	position: 'top' | 'bottom'
}

interface IRect {
	top: number
	left: number
	width: number
	height: number
}

export function useInspectorPosition(
	position: IFloatingInspectorPosition,
	visible: boolean
): React.CSSProperties | undefined {
	const [viewportRect, setViewportRect] = useState<IRect | null>(null)

	useEffect(() => {
		if (!visible) return

		setViewportRect({
			top: window.scrollY,
			left: window.scrollY,
			width: window.innerWidth,
			height: window.innerHeight,
		})
	}, [visible])

	const result = useMemo<React.CSSProperties | undefined>(() => {
		if (!visible) return undefined

		return {
			top: position.top + 'px',
			left: position.left + 'px',
			transform: 'translate(0, -100%)',
		}
	}, [position, visible, viewportRect])

	return result
}
