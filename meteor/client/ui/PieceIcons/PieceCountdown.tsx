import React from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { SourceLayerType, VTContent } from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseId } from '../../../lib/collections/ShowStyleBases'
import { PubSub } from '../../../lib/api/pubsub'
import { PartInstanceId } from '../../../lib/collections/PartInstances'
import { RundownId } from '../../../lib/collections/Rundowns'
import { findPieceInstanceToShow } from './utils'
import { Timediff } from '../ClockView/Timediff'
import { getCurrentTime } from '../../../lib/lib'
import { RundownPlaylistActivationId } from '../../../lib/collections/RundownPlaylists'

export interface IPropsHeader {
	partInstanceId: PartInstanceId
	rundownIds: RundownId[]
	showStyleBaseId: ShowStyleBaseId
	playlistActivationId: RundownPlaylistActivationId | undefined
	partExpectedDuration: number | undefined
	partStartedPlayback: number | undefined
	partAutoNext: boolean
}

const supportedLayers = new Set([
	SourceLayerType.GRAPHICS,
	SourceLayerType.LIVE_SPEAK,
	SourceLayerType.REMOTE,
	SourceLayerType.SPLITS,
	SourceLayerType.VT,
	SourceLayerType.CAMERA,
])

export function PieceCountdownContainer(props: IPropsHeader): JSX.Element | null {
	const { pieceInstance, sourceLayer } = useTracker(
		() => findPieceInstanceToShow(props, supportedLayers),
		[props.partInstanceId, props.showStyleBaseId],
		{
			sourceLayer: undefined,
			pieceInstance: undefined,
		}
	)

	useSubscription(PubSub.pieceInstancesSimple, {
		rundownId: { $in: props.rundownIds },
		playlistActivationId: props.playlistActivationId,
	})

	useSubscription(PubSub.showStyleBases, {
		_id: props.showStyleBaseId,
	})

	const piece = pieceInstance ? pieceInstance.piece : undefined
	const sourceDuration = (piece?.content as VTContent)?.sourceDuration
	const seek = (piece?.content as VTContent)?.seek || 0
	const postrollDuration = (piece?.content as VTContent)?.postrollDuration || 0
	const pieceEnable = typeof piece?.enable.start !== 'number' ? 0 : piece?.enable.start
	if (
		props.partStartedPlayback &&
		sourceLayer &&
		piece &&
		piece.content &&
		sourceDuration &&
		((props.partAutoNext && pieceEnable + (sourceDuration - seek) < (props.partExpectedDuration || 0)) ||
			(!props.partAutoNext &&
				Math.abs(pieceEnable + (sourceDuration - seek) - (props.partExpectedDuration || 0)) > 500))
	) {
		const freezeCountdown =
			props.partStartedPlayback + pieceEnable + (sourceDuration - seek) + postrollDuration - getCurrentTime()

		if (freezeCountdown > 0) {
			return (
				<>
					<Timediff time={freezeCountdown} />
					<img className="freeze-icon" src="/icons/freeze-presenter-screen.svg" />
				</>
			)
		}
	}
	return null
}
