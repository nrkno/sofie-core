import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import * as React from 'react'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import { SourceLayerType, ISourceLayer, CameraContent, RemoteContent } from 'tv-automation-sofie-blueprints-integration'
import { normalizeArray } from '../../../lib/lib'
import * as _ from 'underscore'

import CamInputIcon from './Renderers/CamInput'
import VTInputIcon from './Renderers/VTInput'
import SplitInputIcon from './Renderers/SplitInput'
import RemoteInputIcon from './Renderers/RemoteInput'
import LiveSpeakInputIcon from './Renderers/LiveSpeakInput'
import GraphicsInputIcon from './Renderers/GraphicsInput'
import { Meteor } from 'meteor/meteor'
import { ShowStyleBases, ShowStyleBaseId } from '../../../lib/collections/ShowStyleBases'
import { PubSub } from '../../../lib/api/pubsub'
import { PieceInstances, PieceInstance } from '../../../lib/collections/PieceInstances'
import { PartInstanceId } from '../../../lib/collections/PartInstances'
import { RundownId } from '../../../lib/collections/Rundowns'

interface IPropsHeader {
	partInstanceId: PartInstanceId
	rundownIds: RundownId[]
	showStyleBaseId: ShowStyleBaseId
}

interface INamePropsHeader extends IPropsHeader {
	partName: string
}

function findPieceInstanceToShow(props: IPropsHeader, supportedLayers: Set<SourceLayerType>) {
	let pieceInstances = PieceInstances.find({ partInstanceId: props.partInstanceId }).fetch()
	let showStyleBase = ShowStyleBases.findOne(props.showStyleBaseId)

	let sourceLayers = showStyleBase
		? normalizeArray<ISourceLayer>(
				showStyleBase.sourceLayers.map((layer) => ({ ...layer })),
				'_id'
		  )
		: {}
	let foundSourceLayer: ISourceLayer | undefined
	let foundPiece: PieceInstance | undefined

	for (const pieceInstance of pieceInstances) {
		let layer = sourceLayers[pieceInstance.piece.sourceLayerId]
		if (layer && layer.onPresenterScreen && supportedLayers.has(layer.type)) {
			if (foundSourceLayer && foundPiece) {
				if (foundSourceLayer._rank >= layer._rank) {
					foundSourceLayer = layer
					if (
						pieceInstance.piece.enable &&
						foundPiece.piece.enable &&
						(pieceInstance.piece.enable.start || 0) > (foundPiece.piece.enable.start || 0) // TODO: look into this, what should the do, really?
					) {
						foundPiece = pieceInstance
					}
				}
			} else {
				foundSourceLayer = layer
				foundPiece = pieceInstance
			}
		}
	}

	return {
		sourceLayer: foundSourceLayer,
		pieceInstance: foundPiece,
	}
}

export const PieceNameContainer = withTracker((props: INamePropsHeader) => {
	const supportedLayers = new Set([SourceLayerType.GRAPHICS, SourceLayerType.LIVE_SPEAK, SourceLayerType.VT])
	return findPieceInstanceToShow(props, supportedLayers)
})(
	class PieceNameContainer extends MeteorReactComponent<
		INamePropsHeader & { sourceLayer: ISourceLayer; pieceInstance: PieceInstance }
	> {
		componentDidMount() {
			this.subscribe(PubSub.pieceInstancesSimple, {
				rundownId: { $in: this.props.rundownIds },
			})
			this.subscribe(PubSub.showStyleBases, {
				_id: this.props.showStyleBaseId,
			})
		}

		render() {
			if (this.props.sourceLayer) {
				switch (this.props.sourceLayer.type) {
					case SourceLayerType.GRAPHICS:
					case SourceLayerType.LIVE_SPEAK:
					case SourceLayerType.VT:
						return this.props.pieceInstance.piece.name
				}
			}
			return this.props.partName || ''
		}
	}
)

export const PieceIconContainer = withTracker((props: IPropsHeader) => {
	const supportedLayers = new Set([
		SourceLayerType.GRAPHICS,
		SourceLayerType.LIVE_SPEAK,
		SourceLayerType.REMOTE,
		SourceLayerType.SPLITS,
		SourceLayerType.VT,
		SourceLayerType.CAMERA,
	])
	return findPieceInstanceToShow(props, supportedLayers)
})(
	class PieceIconContainer extends MeteorReactComponent<
		IPropsHeader & { sourceLayer: ISourceLayer; pieceInstance: PieceInstance }
	> {
		componentDidMount() {
			this.subscribe(PubSub.pieceInstancesSimple, {
				rundownId: { $in: this.props.rundownIds },
			})
			this.subscribe(PubSub.showStyleBases, {
				_id: this.props.showStyleBaseId,
			})
		}

		render() {
			if (this.props.sourceLayer) {
				const piece = this.props.pieceInstance ? this.props.pieceInstance.piece : undefined

				switch (this.props.sourceLayer.type) {
					case SourceLayerType.GRAPHICS:
						return <GraphicsInputIcon abbreviation={this.props.sourceLayer.abbreviation} />
					case SourceLayerType.LIVE_SPEAK:
						return <LiveSpeakInputIcon abbreviation={this.props.sourceLayer.abbreviation} />
					case SourceLayerType.REMOTE:
						const rmContent = piece ? (piece.content as RemoteContent | undefined) : undefined
						return (
							<RemoteInputIcon
								inputIndex={rmContent ? rmContent.studioLabel : ''}
								abbreviation={this.props.sourceLayer.abbreviation}
							/>
						)
					case SourceLayerType.SPLITS:
						return <SplitInputIcon abbreviation={this.props.sourceLayer.abbreviation} piece={piece} />
					case SourceLayerType.VT:
						return <VTInputIcon abbreviation={this.props.sourceLayer.abbreviation} />
					case SourceLayerType.CAMERA:
						const camContent = piece ? (piece.content as CameraContent | undefined) : undefined
						return (
							<CamInputIcon
								inputIndex={camContent ? camContent.studioLabel : ''}
								abbreviation={this.props.sourceLayer.abbreviation}
							/>
						)
				}
			}
			return null
		}
	}
)
