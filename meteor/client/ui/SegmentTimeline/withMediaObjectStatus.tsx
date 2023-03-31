import React, { useMemo } from 'react'
import { PieceUi } from './SegmentTimelineContainer'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../lib/rundown'
import { IAdLibListItem } from '../Shelf/AdLibListItem'
import { BucketAdLibUi, BucketAdLibActionUi } from '../Shelf/RundownViewBuckets'

import { AdLibPieceUi } from '../../lib/shelf'
import { UIStudio } from '../../../lib/api/studios'
import { PieceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { UIPieceContentStatuses } from '../Collections'

type SomePiece = BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi | BucketAdLibActionUi

type AnyPiece = {
	piece?: SomePiece | undefined
	layer?: ISourceLayer | undefined
	isLiveLine?: boolean
	studio: UIStudio | undefined
}

export function useMediaObjectStatus<T extends SomePiece>(piece: T | undefined): T | undefined {
	const pieceId = getPieceId(piece)

	const processedPiece = useTracker(() => {
		if (!piece) return undefined
		if (!pieceId) return undefined

		const uiPieceContentStatus = UIPieceContentStatuses.findOne({
			pieceId,
		})

		if (!uiPieceContentStatus) return undefined

		const { metadata, packageInfos, status, contentDuration, messages } = uiPieceContentStatus.status

		if (RundownUtils.isAdLibPieceOrAdLibListItem(piece)) {
			const pieceCopy = {
				...piece,
				status,
				contentMetaData: metadata,
				contentPackageInfos: packageInfos,
				messages,
			}

			if (pieceCopy.content && pieceCopy.content.sourceDuration === undefined && contentDuration !== undefined) {
				pieceCopy.content.sourceDuration = contentDuration
			}

			return pieceCopy
		} else {
			const pieceCopy = {
				...piece,
				instance: {
					...piece.instance,
					piece: {
						...piece.instance.piece,
						status,
					},
				},
				contentMetaData: metadata,
				contentPackageInfos: packageInfos,
				messages,
			}

			if (
				pieceCopy.instance.piece.content &&
				pieceCopy.instance.piece.content.sourceDuration === undefined &&
				contentDuration !== undefined
			) {
				pieceCopy.instance.piece.content.sourceDuration = contentDuration
			}

			return pieceCopy
		}
	}, [pieceId, piece])

	return processedPiece
}

export const withMediaObjectStatus = <TProps extends AnyPiece>() => {
	return (WrappedComponent: React.ComponentType<TProps>): React.ComponentType<TProps> => {
		return function WithMediaObjectStatusHOC(props: TProps): JSX.Element {
			const processedPiece = useMediaObjectStatus(props.piece)

			const overrides = useMemo(
				() => ({
					piece: processedPiece ?? props.piece,
				}),
				[processedPiece, props.piece]
			)

			return <WrappedComponent {...props} {...overrides} />
		}
	}
}

function getPieceId(
	piece: BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi | BucketAdLibActionUi | undefined
): PieceId | undefined {
	if (!piece) return undefined
	if (RundownUtils.isAdLibPieceOrAdLibListItem(piece)) {
		return piece._id
	}
	if (piece) {
		return piece.instance.piece._id
	}
}
