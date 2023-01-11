import React, { useCallback, useMemo } from 'react'
import { PubSub } from '../../../../lib/api/pubsub'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { AdLibActions, AdLibAction } from '../../../../lib/collections/AdLibActions'
import { AdLibPiece, AdLibPieces } from '../../../../lib/collections/AdLibPieces'
import { ISourceLayerExtended } from '../../../../lib/Rundown'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { LinePartIndicator } from './LinePartIndicator'
import { useTranslation } from 'react-i18next'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import StudioContext from '../../RundownView/StudioContext'
import RundownViewEventBus, { RundownViewEvents } from '../../../../lib/api/triggers/RundownViewEventBus'

interface IProps {
	sourceLayers: ISourceLayerExtended[]
	label: string
	partId: PartId
}

export const LinePartAdLibIndicator: React.FC<IProps> = function LinePartAdLibIndicator({ sourceLayers, partId }) {
	const { t } = useTranslation()

	const sourceLayerIds = useMemo(() => sourceLayers.map((sourceLayer) => sourceLayer._id), [sourceLayers])
	const label = useMemo(() => sourceLayers[0]?.name ?? '', [sourceLayers])

	useSubscription(PubSub.adLibPieces, {
		partId,
		sourceLayerId: {
			$in: sourceLayerIds,
		},
	})

	useSubscription(PubSub.adLibActions, {
		partId,
		'display.sourceLayerId': {
			$in: sourceLayerIds,
		},
	})

	const adLibPieces = useTracker(
		() =>
			AdLibPieces.find({
				partId,
				sourceLayerId: {
					$in: sourceLayerIds,
				},
			}).fetch(),
		[partId, sourceLayerIds],
		[] as AdLibPiece[]
	)

	const adLibActions = useTracker(
		() =>
			AdLibActions.find({
				partId,
				'display.sourceLayerId': {
					$in: sourceLayerIds,
				},
			}).fetch(),
		[partId, sourceLayerIds],
		[] as AdLibAction[]
	)

	const allAdLibLabels = useMemo(
		() =>
			adLibPieces
				.map((adLibPiece) => adLibPiece.name)
				.concat(adLibActions.map((adLibAction) => translateMessage(adLibAction.display.label, t))),
		[adLibPieces, adLibActions]
	)

	const onClick = useCallback(() => {
		const pieceId = adLibPieces[0]?._id || adLibActions[0]?._id
		RundownViewEventBus.emit(RundownViewEvents.SHELF_STATE, {
			state: true,
		})
		setTimeout(() => {
			RundownViewEventBus.emit(RundownViewEvents.REVEAL_IN_SHELF, {
				pieceId: pieceId,
			})
		}, 100)
	}, [adLibPieces, adLibActions])

	return (
		<StudioContext.Consumer>
			{(studio) => {
				if (!studio) return null

				return (
					<LinePartIndicator
						allSourceLayers={sourceLayers}
						count={allAdLibLabels.length}
						label={label.substring(0, 1)}
						thisSourceLayer={sourceLayers[0]}
						hasOriginInPreceedingPart={false}
						studio={studio}
						piece={adLibPieces[0]}
						onClick={onClick}
					/>
				)
			}}
		</StudioContext.Consumer>
	)
}
