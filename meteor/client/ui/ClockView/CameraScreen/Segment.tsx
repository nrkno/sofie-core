import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import React, { useContext, useMemo } from 'react'
import { ActivePartInstancesContext, PieceFilter } from '.'
import { withResolvedSegment } from '../../SegmentContainer/withResolvedSegment'
import { OrderedPartsContext } from './OrderedPartsProvider'
import { Part } from './Part'

export const Segment = withResolvedSegment(({ parts, segmentui }) => {
	const activePartInstances = useContext(ActivePartInstancesContext)

	const orderedPartIds = useContext(OrderedPartsContext)

	const livePartIndex = useMemo(
		() =>
			activePartInstances.currentPartInstance?.part._id
				? orderedPartIds.indexOf(activePartInstances.currentPartInstance?.part._id)
				: -1,
		[activePartInstances.currentPartInstance?.part._id]
	)

	const nextPartIndex = useMemo(
		() =>
			activePartInstances.nextPartInstance?.part._id
				? orderedPartIds.indexOf(activePartInstances.nextPartInstance?.part._id)
				: -1,
		[activePartInstances.nextPartInstance?.part._id]
	)

	const unplayedValidParts = useMemo(
		() => parts.filter((part) => !part.instance.part.invalid && !part.instance.timings?.plannedStoppedPlayback),
		[parts, orderedPartIds]
	)

	const selectPiece = useContext(PieceFilter)

	const partsAndPieces = useMemo(
		() =>
			unplayedValidParts
				.map((part) => ({ part, piece: part.pieces.find(selectPiece) }))
				.filter(
					(pair) =>
						pair.piece !== undefined &&
						(orderedPartIds.indexOf(pair.part.partId) >= nextPartIndex ||
							orderedPartIds.indexOf(pair.part.partId) === livePartIndex)
				),
		[selectPiece, parts, livePartIndex, nextPartIndex]
	)

	if (partsAndPieces.length === 0) return null

	return (
		<div className="camera-screen__segment">
			<div className="camera-screen__segment-name">{segmentui?.name}</div>
			{partsAndPieces.map(({ part, piece }) => {
				const isLive = activePartInstances.currentPartInstance?._id === part.instance._id
				const isNext = activePartInstances.nextPartInstance?._id === part.instance._id

				return (
					<Part
						key={unprotectString(part.instance._id)}
						part={part}
						piece={piece!}
						isLive={isLive}
						isNext={isNext}
					></Part>
				)
			})}
		</div>
	)
})
