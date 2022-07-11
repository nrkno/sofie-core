import React, { useEffect, useMemo } from 'react'
import { PubSub } from '../../../../lib/api/pubsub'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { AdLibActions, AdLibAction } from '../../../../lib/collections/AdLibActions'
import { AdLibPiece, AdLibPieces } from '../../../../lib/collections/AdLibPieces'
import { ISourceLayerExtended } from '../../../../lib/Rundown'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { LinePartIndicator } from './LinePartIndicator'
import { useTranslation } from 'react-i18next'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'

interface IProps {
	sourceLayers: ISourceLayerExtended[]
	label: string
	partId: PartId
}

export const LinePartAdLibIndicator: React.FC<IProps> = function LinePartAdLibIndicator({ sourceLayers, partId }) {
	const { t } = useTranslation()
	useEffect(() => {
		console.log(sourceLayers)
	}, [sourceLayers])

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

	const allAdLibs = useMemo(
		() =>
			adLibPieces
				.map((adLibPiece) => adLibPiece.name)
				.concat(adLibActions.map((adLibAction) => translateMessage(adLibAction.display.label, t))),
		[adLibPieces, adLibActions]
	)

	return (
		<LinePartIndicator
			allSourceLayers={sourceLayers}
			count={allAdLibs.length}
			label={label.substring(0, 1)}
			thisSourceLayer={sourceLayers[0]}
			overlay={
				<>
					<b>{t('{{sourceLayer}} AdLibs', { sourceLayer: label })}</b>
					{': '}
					{allAdLibs.join(', ')}
				</>
			}
		/>
	)
}
