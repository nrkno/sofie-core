import * as React from 'react'
import { PieceGeneric } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { SplitsContent, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../../../lib/rundown'
import classNames from 'classnames'
import { ReadonlyDeep } from 'type-fest'

type SplitIconPieceType = ReadonlyDeep<Omit<PieceGeneric, 'timelineObjectsString'>>

export default class SplitInputIcon extends React.Component<{
	abbreviation: string | undefined
	piece: SplitIconPieceType | undefined
	hideLabel?: boolean
}> {
	private getCameraLabel(piece: SplitIconPieceType | undefined) {
		if (piece && piece.content) {
			const c = piece.content as SplitsContent
			const camera = c.boxSourceConfiguration.find((i) => i.type === SourceLayerType.CAMERA)
			if (camera && camera.studioLabel) {
				const label = camera.studioLabelShort || camera.studioLabel.match(/([a-zA-Z]+)?(\d+)/)
				return (
					<React.Fragment>
						{label && label[1] ? label[1].substr(0, 1).toUpperCase() + ' ' : ''}
						<span className="camera">{label ? label[2] : ''}</span>
					</React.Fragment>
				)
			} else {
				return this.props.abbreviation !== undefined ? this.props.abbreviation : 'Spl'
			}
		} else {
			return this.props.abbreviation !== undefined ? this.props.abbreviation : 'Spl'
		}
	}

	private getLeftSourceType(piece: SplitIconPieceType | undefined): string {
		if (piece && piece.content) {
			const c = piece.content as SplitsContent
			const left = (c.boxSourceConfiguration && c.boxSourceConfiguration[0])?.type || SourceLayerType.CAMERA
			return RundownUtils.getSourceLayerClassName(left)
		}
		return 'camera'
	}

	private getRightSourceType(piece: SplitIconPieceType | undefined): string {
		if (piece && piece.content) {
			const c = piece.content as SplitsContent
			const right = (c.boxSourceConfiguration && c.boxSourceConfiguration[1])?.type || SourceLayerType.REMOTE
			const sourceType = RundownUtils.getSourceLayerClassName(right)
			return sourceType + (this.getLeftSourceType(piece) === sourceType ? ' second' : '')
		}
		return 'remote'
	}

	render(): JSX.Element {
		return (
			<div className="clock-view-piece-icon">
				<rect width="126.5" height="44.5" className={classNames('upper', this.getLeftSourceType(this.props.piece))} />
				<rect
					width="126.5"
					height="44.5"
					y="44.5"
					className={classNames('lower', this.getRightSourceType(this.props.piece))}
				/>
				{!this.props.hideLabel && <span className="piece-icon-text">{this.getCameraLabel(this.props.piece)}</span>}
			</div>
		)
	}
}
