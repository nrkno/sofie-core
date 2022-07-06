import classNames from 'classnames'
import Tooltip from 'rc-tooltip'
import React, { useMemo } from 'react'
import { ISourceLayerExtended, PieceExtended } from '../../../../lib/Rundown'
import { RundownUtils } from '../../../lib/rundown'

interface IProps {
	label: string
	sourceLayers: ISourceLayerExtended[]
	pieces: PieceExtended[]
}

export const LinePartPieceIndicator: React.FC<IProps> = function LinePartPieceIndicator({
	label,
	pieces,
	sourceLayers,
}) {
	const sourceLayerIds = useMemo(() => sourceLayers.map((layer) => layer._id), [sourceLayers])
	const thisPieces = useMemo(
		() =>
			pieces.filter(
				(piece) =>
					piece.sourceLayer &&
					sourceLayerIds.includes(piece.sourceLayer._id) &&
					(piece.renderedDuration === null || piece.renderedDuration > 0)
			),
		[pieces, sourceLayerIds]
	)

	const hasPiece = thisPieces[0]

	const typeClass = hasPiece?.sourceLayer?.type
		? RundownUtils.getSourceLayerClassName(hasPiece?.sourceLayer?.type)
		: undefined

	return (
		<Tooltip
			overlay={
				<>
					<b>{label}</b>:{' '}
					{thisPieces.length === 0 ? 'Not present' : thisPieces.map((piece) => piece.instance.piece.name).join(', ')}
				</>
			}
			placement="top"
		>
			<div
				className={classNames('segment-opl__piece-indicator-placeholder', {
					multiple: thisPieces.length > 1,
					'multiple--2': thisPieces.length === 2,
					'multiple--3': thisPieces.length > 2,
				})}
				data-source-layer-ids={sourceLayers.map((sourceLayer) => sourceLayer._id).join(' ')}
			>
				{thisPieces.length === 0 && (
					<div className={classNames('segment-opl__piece-indicator', 'segment-opl__piece-indicator--no-piece')}></div>
				)}
				{/* thisPieces.length > 2 && <div className={classNames('segment-opl__piece-indicator', typeClass)}></div> */}
				{thisPieces.length > 1 && <div className={classNames('segment-opl__piece-indicator', typeClass)}></div>}
				{thisPieces.length > 0 && (
					<div className={classNames('segment-opl__piece-indicator', typeClass)}>{label.substring(0, 1)}</div>
				)}
			</div>
		</Tooltip>
	)
}
