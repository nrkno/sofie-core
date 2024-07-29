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
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { UIBucketContentStatus, UIPieceContentStatus } from '../../../lib/api/rundownNotifications'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { ReadonlyDeep } from 'type-fest'

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

export interface WithMediaObjectStatusProps {
	contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined
}

/**
 * @deprecated This can now be achieved by a simple minimongo query against either UIPieceContentStatuses or UIBucketContentStatuses
 */
export function withMediaObjectStatus<IProps extends AnyPiece, IState>(): (
	WrappedComponent:
		| IWrappedComponent<IProps & WithMediaObjectStatusProps, IState>
		| React.FC<IProps & WithMediaObjectStatusProps>
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

			const statusObj: ReadonlyDeep<PieceContentStatusObj> | undefined = useTracker(() => {
				const { piece, studio, layer } = props

				// Check item status
				if (piece && (piece.sourceLayer || layer) && studio) {
					// Extract the status or populate some default values
					return getStatusDocForPiece(piece)?.status ?? DEFAULT_STATUS
				}
				return undefined
			}, [props.piece, props.studio, props.isLiveLine, invalidationToken])

			return <WrappedComponent {...props} contentStatus={statusObj} />
		}
	}
}

export function useContentStatusForAdlibPiece(
	piece: Pick<AdLibPiece, '_id' | 'rundownId'> | undefined
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
	piece: (Pick<PieceInstance, '_id' | 'rundownId'> & { piece: Pick<Piece, '_id'> }) | undefined
): PieceContentStatusObj | undefined {
	return useTracker(() => {
		if (!piece) return undefined

		// PieceInstance's might have a dedicated status
		const instanceStatus = UIPieceContentStatuses.findOne({
			pieceId: piece._id,
			rundownId: piece.rundownId || { $exists: false },
		})

		if (instanceStatus) return instanceStatus.status

		// Fallback to using the one from the source piece
		return UIPieceContentStatuses.findOne({
			pieceId: piece.piece._id,
			// Future: It would be good for this to be stricter.
			rundownId: piece.rundownId || { $exists: false },
		})?.status
	}, [piece?._id, piece?.rundownId])
}

export function useContentStatusForItem(
	piece: BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi | BucketAdLibActionUi
): ReadonlyDeep<PieceContentStatusObj> | undefined {
	return useTracker(() => getStatusDocForPiece(piece)?.status, [piece])
}
