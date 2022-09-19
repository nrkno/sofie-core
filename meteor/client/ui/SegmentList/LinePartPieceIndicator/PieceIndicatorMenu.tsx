import React, { useLayoutEffect, useState } from 'react'
import Escape from 'react-escape'
import { PieceExtended } from '../../../../lib/Rundown'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { usePopper } from 'react-popper'

export function PieceIndicatorMenu({ pieces, parentEl }: { pieces: PieceExtended[]; parentEl: HTMLDivElement | null }) {
	const [indicatorMenuEl, setIndicatorMenuEl] = useState<HTMLDivElement | null>(null)
	const { styles, attributes, update } = usePopper(parentEl, indicatorMenuEl, {
		placement: 'top',
		modifiers: [
			{
				name: 'offset',
				options: {
					offset: [0, 0],
				},
			},
			// sameWidth,
		],
	})

	useLayoutEffect(() => {
		update && update().catch(console.error)
	}, [pieces.length])

	return (
		<Escape to="viewport">
			<div
				className="segment-opl__piece-indicator-menu"
				ref={setIndicatorMenuEl}
				style={styles.popper}
				{...attributes.popper}
			>
				{pieces.map((piece) => (
					<p key={unprotectString(piece.instance._id)}>{piece.instance.piece.name}</p>
				))}
			</div>
		</Escape>
	)
}
