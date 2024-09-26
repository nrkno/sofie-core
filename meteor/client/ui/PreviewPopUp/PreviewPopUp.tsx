import React, { useMemo, useState } from 'react'
import classNames from 'classnames'
import { usePopper } from 'react-popper'
import { Padding, Placement, VirtualElement } from '@popperjs/core'

export function PreviewPopUp({
	anchor,
	padding,
	placement,
	hidden,
	size,
	preview,
	controls,
	contentInfo,
	warnings,
}: {
	anchor: HTMLElement | VirtualElement | null
	padding: Padding
	placement: Placement
	size: 'small' | 'large'
	hidden?: boolean
	preview?: React.ReactNode
	controls?: React.ReactNode
	contentInfo?: React.ReactNode
	warnings?: React.ReactNode
}): React.JSX.Element {
	const warningsCount = React.Children.count(warnings)

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
	const { styles, attributes } = usePopper(anchor, popperEl, popperOptions)

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
			{preview && <div className="preview-popUp__preview">{preview}</div>}
			{controls && <div className="preview-popUp__controls">{controls}</div>}
			{contentInfo && <div className="preview-popUp__content-info">{contentInfo}</div>}
			{warnings && warningsCount > 0 && (
				<div className="preview-popUp__warnings">
					{React.Children.map(warnings, (child) => (
						<div className="preview-popUp__warning-row">{child}</div>
					))}
				</div>
			)}
		</div>
	)
}
