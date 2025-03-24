import * as React from 'react'
import { PieceGeneric } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { SplitsContent, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../../lib/rundown.js'
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
						<tspan style={{ fontFamily: 'Roboto', fontWeight: 'normal' }}>{label ? label[2] : ''}</tspan>
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
			<svg
				className="piece-icon"
				version="1.1"
				viewBox="0 0 126.5 89"
				xmlns="http://www.w3.org/2000/svg"
				preserveAspectRatio="none"
			>
				<rect width="126.5" height="44.5" className={classNames('upper', this.getLeftSourceType(this.props.piece))} />
				<rect
					width="126.5"
					height="44.5"
					y="44.5"
					className={classNames('lower', this.getRightSourceType(this.props.piece))}
				/>
				{!this.props.hideLabel && (
					<text
						x="63.25"
						y="71.513954"
						textAnchor="middle"
						textLength="126.5"
						className="piece-icon-text"
						xmlSpace="preserve"
					>
						<tspan lengthAdjust="spacing" className="label">
							{this.getCameraLabel(this.props.piece)}
						</tspan>
					</text>
				)}
			</svg>
		)
	}
}
