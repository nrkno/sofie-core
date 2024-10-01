import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { usePopper } from 'react-popper'
import { Padding, Placement, VirtualElement } from '@popperjs/core'

export const PreviewPopUp = React.forwardRef<
	PreviewPopUpHandle,
	React.PropsWithChildren<{
		anchor: HTMLElement | VirtualElement | null
		padding: Padding
		placement: Placement
		size: 'small' | 'large'
		hidden?: boolean
		preview?: React.ReactNode
		controls?: React.ReactNode
		contentInfo?: React.ReactNode
		warnings?: React.ReactNode[]
	}>
>(function PreviewPopUp(
	{ anchor, padding, placement, hidden, size, children, controls, contentInfo, warnings },
	ref
): React.JSX.Element {
	const warningsCount = warnings?.length ?? 0

	const [popperEl, setPopperEl] = useState<HTMLDivElement | null>(null)
	const popperOptions = useMemo(
		() => ({
			placement: placement ?? 'top',
			strategy: 'fixed' as const,
			modifiers: [
				{
					name: 'flip',
					options: {
						fallbackPlacements: [
							'top-start',
							'top-end',
							'right',
							'right-start',
							'right-end',
							'left',
							'left-start',
							'left-end',
							'bottom',
							'bottom-start',
							'bottom-end',
						],
						rootBoundary: 'viewport',
						padding: padding ?? 0,
					},
				},
				{
					name: 'preventOverflow',
					options: {
						padding: padding ?? 0, // additional padding placed here (like Header, etc.)
					},
				},
			],
		}),
		[padding]
	)
	const { styles, attributes, update } = usePopper(anchor, popperEl, popperOptions)

	const updateRef = useRef(update)

	useEffect(() => {
		updateRef.current = update
	}, [update])

	useImperativeHandle(
		ref,
		() => {
			return {
				update: () => {
					if (!updateRef.current) return
					updateRef.current().catch(console.error)
				},
			}
		},
		[]
	)

	return (
		<div
			ref={setPopperEl}
			className={classNames('preview-popUp', {
				'preview-popUp--large': size === 'large',
				'preview-popUp--small': size === 'small',
				'preview-popUp--hidden': hidden,
			})}
			style={styles.popper}
			{...attributes.popper}
		>
			{children && <div className="preview-popUp__preview">{children}</div>}
			{controls && <div className="preview-popUp__controls">{controls}</div>}
			{contentInfo && <div className="preview-popUp__content-info">{contentInfo}</div>}
			{warnings && warningsCount > 0 && (
				<div className="preview-popUp__warnings">
					{React.Children.map(warnings, (child, index) => (
						<div className="preview-popUp__warning-row" key={index}>
							{child}
						</div>
					))}
				</div>
			)}
		</div>
	)
})

export type PreviewPopUpHandle = {
	readonly update: () => void
}
