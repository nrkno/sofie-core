import React from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import {
	SourceLayerType,
	ISourceLayer,
	CameraContent,
	RemoteContent,
	EvsContent,
} from '@sofie-automation/blueprints-integration'
import CamInputIcon from './Renderers/CamInputIcon'
import VTInputIcon from './Renderers/VTInputIcon'
import SplitInputIcon from './Renderers/SplitInputIcon'
import RemoteInputIcon from './Renderers/RemoteInputIcon'
import LiveSpeakInputIcon from './Renderers/LiveSpeakInputIcon'
import GraphicsInputIcon from './Renderers/GraphicsInputIcon'
import UnknownInputIcon from './Renderers/UnknownInputIcon'
import { ShowStyleBaseId } from '../../../lib/collections/ShowStyleBases'
import { PubSub } from '../../../lib/api/pubsub'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { PartInstanceId } from '../../../lib/collections/PartInstances'
import { RundownId } from '../../../lib/collections/Rundowns'
import { findPieceInstanceToShow, findPieceInstanceToShowFromInstances } from './utils'
import { RundownPlaylistActivationId } from '../../../lib/collections/RundownPlaylists'
import LocalInputIcon from './Renderers/LocalInputIcon'

export interface IPropsHeader {
	partInstanceId: PartInstanceId
	rundownIds: RundownId[]
	showStyleBaseId: ShowStyleBaseId
	playlistActivationId: RundownPlaylistActivationId | undefined
}

export const PieceIcon = (props: {
	pieceInstance: PieceInstance | undefined
	sourceLayer: ISourceLayer | undefined
	renderUnknown?: boolean
}) => {
	const piece = props.pieceInstance ? props.pieceInstance.piece : undefined
	if (props.sourceLayer && piece) {
		switch (props.sourceLayer.type) {
			case SourceLayerType.GRAPHICS:
				return <GraphicsInputIcon abbreviation={props.sourceLayer.abbreviation} />
			case SourceLayerType.LIVE_SPEAK:
				return <LiveSpeakInputIcon abbreviation={props.sourceLayer.abbreviation} />
			case SourceLayerType.REMOTE: {
				const rmContent = piece ? (piece.content as RemoteContent | undefined) : undefined
				return (
					<RemoteInputIcon
						inputIndex={rmContent ? rmContent.studioLabel : undefined}
						abbreviation={props.sourceLayer.abbreviation}
					/>
				)
			}
			case SourceLayerType.LOCAL: {
				const localContent = piece ? (piece.content as EvsContent | undefined) : undefined
				return (
					<LocalInputIcon
						inputIndex={localContent ? localContent.studioLabel : undefined}
						abbreviation={props.sourceLayer.abbreviation}
					/>
				)
			}
			case SourceLayerType.SPLITS:
				return <SplitInputIcon abbreviation={props.sourceLayer.abbreviation} piece={piece} />
			case SourceLayerType.VT:
				return <VTInputIcon abbreviation={props.sourceLayer.abbreviation} />
			case SourceLayerType.CAMERA: {
				const camContent = piece ? (piece.content as CameraContent | undefined) : undefined
				return (
					<CamInputIcon
						inputIndex={camContent ? camContent.studioLabel : undefined}
						abbreviation={props.sourceLayer.abbreviation}
					/>
				)
			}
		}
	}

	if (props.renderUnknown) {
		return <UnknownInputIcon />
	}

	return null
}

export const pieceIconSupportedLayers = new Set([
	SourceLayerType.GRAPHICS,
	SourceLayerType.LIVE_SPEAK,
	SourceLayerType.REMOTE,
	SourceLayerType.SPLITS,
	SourceLayerType.VT,
	SourceLayerType.CAMERA,
	SourceLayerType.LOCAL,
])

export function PieceIconContainerNoSub({
	pieceInstances,
	sourceLayers,
	renderUnknown,
}: {
	pieceInstances: PieceInstance[]
	sourceLayers: {
		[key: string]: ISourceLayer
	}
	renderUnknown?: boolean
}): JSX.Element | null {
	const { pieceInstance, sourceLayer } = useTracker(
		() => findPieceInstanceToShowFromInstances(pieceInstances, sourceLayers, pieceIconSupportedLayers),
		[pieceInstances, sourceLayers],
		{
			sourceLayer: undefined,
			pieceInstance: undefined,
		}
	)

	return <PieceIcon pieceInstance={pieceInstance} sourceLayer={sourceLayer} renderUnknown={renderUnknown} />
}

export function PieceIconContainer(props: IPropsHeader): JSX.Element | null {
	const { pieceInstance, sourceLayer } = useTracker(
		() => findPieceInstanceToShow(props, pieceIconSupportedLayers),
		[props.partInstanceId, props.showStyleBaseId],
		{
			pieceInstance: undefined,
			sourceLayer: undefined,
		}
	)

	useSubscription(PubSub.pieceInstancesSimple, {
		rundownId: { $in: props.rundownIds },
		playlistActivationId: props.playlistActivationId,
	})

	useSubscription(PubSub.showStyleBases, {
		_id: props.showStyleBaseId,
	})

	return <PieceIcon pieceInstance={pieceInstance} sourceLayer={sourceLayer} />
}
