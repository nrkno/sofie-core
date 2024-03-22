import React, { useEffect, useState } from 'react'
import { PieceUi } from './SegmentTimelineContainer'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../lib/rundown'
import { IAdLibListItem } from '../Shelf/AdLibListItem'
import { BucketAdLibUi, BucketAdLibActionUi } from '../Shelf/RundownViewBuckets'
import { AdLibPieceUi } from '../../lib/shelf'
import { UIStudio } from '../../../lib/api/studios'
import { UIBucketContentStatuses, UIPieceContentStatuses } from '../Collections'
import { Piece, PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceContentStatusObj } from '../../../lib/api/pieceContentStatus'
import { deepFreeze } from '@sofie-automation/corelib/dist/lib'
import _ from 'underscore'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { UIBucketContentStatus, UIPieceContentStatus } from '../../../lib/api/rundownNotifications'

type AnyPiece = {
	piece?: BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi | BucketAdLibActionUi | undefined
	layer?: ISourceLayer | undefined
	isLiveLine?: boolean
	studio: UIStudio | undefined
}

type IWrappedComponent<IProps extends AnyPiece, IState> = new (props: IProps, state: IState) => React.Component<
	IProps,
	IState
>

const DEFAULT_STATUS = deepFreeze<PieceContentStatusObj>({
	status: PieceStatusCode.UNKNOWN,
	messages: [],
	progress: undefined,

	blacks: [],
	freezes: [],
	scenes: [],

	thumbnailUrl: undefined,
	previewUrl: undefined,

	packageName: null,

	contentDuration: undefined,
})

function unwrapPieceInstance(piece: BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi | BucketAdLibActionUi) {
	if (RundownUtils.isPieceInstance(piece)) {
		return piece.instance.piece
	} else {
		return piece
	}
}

function getStatusDocForPiece(
	piece: BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi | BucketAdLibActionUi
): UIPieceContentStatus | UIBucketContentStatus | undefined {
	const pieceUnwrapped = unwrapPieceInstance(piece)

	// Bucket items use a different collection
	if (RundownUtils.isBucketAdLibItem(piece)) {
		return UIBucketContentStatuses.findOne({
			bucketId: piece.bucketId,
			docId: pieceUnwrapped._id,
		})
	}

	// PieceInstance's might have a dedicated status
	if (RundownUtils.isPieceInstance(piece)) {
		const status = UIPieceContentStatuses.findOne({
			// Future: It would be good for this to be stricter.
			pieceId: piece.instance._id,
		})
		if (status) return status
	}

	// Fallback to using the one from the source piece
	return UIPieceContentStatuses.findOne({
		// Future: It would be good for this to be stricter.
		pieceId: pieceUnwrapped._id,
	})
}

/**
 * @deprecated This can now be achieved by a simple minimongo query against either UIPieceContentStatuses or UIBucketContentStatuses
 */
export function withMediaObjectStatus<IProps extends AnyPiece, IState>(): (
	WrappedComponent: IWrappedComponent<IProps, IState> | React.FC<IProps>
) => React.FC<IProps> {
	return (WrappedComponent) => {
		return function WithMediaObjectStatusHOCComponent(props: IProps) {
			const [invalidationToken, setInvalidationToken] = useState(Date.now())
			useEffect(() => {
				// Force an invalidation shortly after mounting
				const callback = window.requestIdleCallback(
					() => {
						setInvalidationToken(Date.now())
					},
					{
						timeout: 500,
					}
				)
				return () => {
					window.cancelIdleCallback(callback)
				}
			}, [])

			const overrides = useTracker(() => {
				const { piece, studio, layer } = props
				const overrides: Partial<IProps> = {}

				// Check item status
				if (piece && (piece.sourceLayer || layer) && studio) {
					// Extract the status or populate some default values
					const statusObj = getStatusDocForPiece(piece)?.status ?? DEFAULT_STATUS

					if (RundownUtils.isAdLibPieceOrAdLibListItem(piece)) {
						if (!overrides.piece || !_.isEqual(statusObj, (overrides.piece as AdLibPieceUi).contentStatus)) {
							// Deep clone the required bits
							const origPiece = (overrides.piece || props.piece) as AdLibPieceUi
							const pieceCopy: AdLibPieceUi = {
								...origPiece,

								contentStatus: statusObj,
							}

							overrides.piece = pieceCopy
						}
					} else if (!overrides.piece || !_.isEqual(statusObj, (overrides.piece as PieceUi).contentStatus)) {
						// Deep clone the required bits
						const pieceCopy: PieceUi = {
							...((overrides.piece || piece) as PieceUi),

							contentStatus: statusObj,
						}

						overrides.piece = pieceCopy
					}
				}

				return overrides
			}, [props.piece, props.studio, props.isLiveLine, invalidationToken])

			return <WrappedComponent {...props} {...overrides} />
		}
	}
}

export function useContentStatusForPiece(
	piece: Pick<Piece, '_id' | 'startRundownId' | 'startSegmentId'> | undefined
): PieceContentStatusObj | undefined {
	return useTracker(
		() =>
			piece
				? UIPieceContentStatuses.findOne({
						pieceId: piece._id,
						rundownId: piece.startRundownId || { $exists: false },
						segmentId: piece.startSegmentId || { $exists: false },
				  })?.status
				: undefined,
		[piece?._id, piece?.startRundownId, piece?.startSegmentId]
	)
}

export function useContentStatusForPieceInstance(
	piece: Pick<PieceInstance, '_id' | 'rundownId'> | undefined
): PieceContentStatusObj | undefined {
	return useTracker(
		() =>
			piece
				? UIPieceContentStatuses.findOne({
						pieceId: piece._id,
						rundownId: piece.rundownId || { $exists: false },
				  })?.status
				: undefined,
		[piece?._id, piece?.rundownId]
	)
}
