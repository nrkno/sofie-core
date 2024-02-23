import * as React from 'react'
import { Tracker } from 'meteor/tracker'
import { PieceUi } from './SegmentTimelineContainer'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../lib/rundown'
import { IAdLibListItem } from '../Shelf/AdLibListItem'
import { BucketAdLibUi, BucketAdLibActionUi } from '../Shelf/RundownViewBuckets'
import { AdLibPieceUi } from '../../lib/shelf'
import { UIStudio } from '../../../lib/api/studios'
import { UIBucketContentStatuses, UIPieceContentStatuses } from '../Collections'
import { Piece, PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceContentStatusObj } from '../../../lib/mediaObjects'
import { deepFreeze } from '@sofie-automation/corelib/dist/lib'
import _ from 'underscore'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'

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

	blacks: [],
	freezes: [],
	scenes: [],

	thumbnailUrl: undefined,
	previewUrl: undefined,

	packageName: null,
})

/**
 * @deprecated This can now be achieved by a simple minimongo query against either UIPieceContentStatuses or UIBucketContentStatuses
 */
export function withMediaObjectStatus<IProps extends AnyPiece, IState>(): (
	WrappedComponent: IWrappedComponent<IProps, IState> | React.FC<IProps>
) => new (props: IProps, context: any) => React.Component<IProps, IState> {
	return (WrappedComponent) => {
		return class WithMediaObjectStatusHOCComponent extends MeteorReactComponent<IProps, IState> {
			private statusComp: Tracker.Computation
			private overrides: Partial<IProps>
			private destroyed: boolean

			private shouldDataTrackerUpdate(prevProps: IProps): boolean {
				if (this.props.piece !== prevProps.piece) return true
				if (this.props.studio !== prevProps.studio) return true
				if (this.props.isLiveLine !== prevProps.isLiveLine) return true
				return false
			}

			private static unwrapPieceInstance(
				piece: BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi | BucketAdLibActionUi
			) {
				if (RundownUtils.isPieceInstance(piece)) {
					return piece.instance.piece
				} else {
					return piece
				}
			}

			private getStatusDocForPiece(
				piece: BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi | BucketAdLibActionUi
			) {
				const pieceUnwrapped = WithMediaObjectStatusHOCComponent.unwrapPieceInstance(piece)

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

			updateDataTracker() {
				if (this.destroyed) return

				this.statusComp = this.autorun(() => {
					const { piece, studio, layer } = this.props
					this.overrides = {}
					const overrides = this.overrides

					// Check item status
					if (piece && (piece.sourceLayer || layer) && studio) {
						// Extract the status or populate some default values
						const statusObj = this.getStatusDocForPiece(piece)?.status ?? DEFAULT_STATUS

						if (RundownUtils.isAdLibPieceOrAdLibListItem(piece)) {
							if (!overrides.piece || !_.isEqual(statusObj, (overrides.piece as AdLibPieceUi).contentStatus)) {
								// Deep clone the required bits
								const origPiece = (overrides.piece || this.props.piece) as AdLibPieceUi
								const pieceCopy: AdLibPieceUi = {
									...(origPiece as AdLibPieceUi),

									contentStatus: statusObj,
								}

								overrides.piece = pieceCopy
							}
						} else {
							if (!overrides.piece || !_.isEqual(statusObj, (overrides.piece as PieceUi).contentStatus)) {
								// Deep clone the required bits
								const pieceCopy: PieceUi = {
									...((overrides.piece || piece) as PieceUi),

									contentStatus: statusObj,
								}

								overrides.piece = pieceCopy
							}
						}
					}

					this.forceUpdate()
				})
			}

			componentDidMount(): void {
				window.requestIdleCallback(
					() => {
						this.updateDataTracker()
					},
					{
						timeout: 500,
					}
				)
			}

			componentDidUpdate(prevProps: IProps) {
				if (this.shouldDataTrackerUpdate(prevProps)) {
					if (this.statusComp) this.statusComp.invalidate()
				}
			}

			componentWillUnmount(): void {
				this.destroyed = true

				super.componentWillUnmount()
			}

			render(): JSX.Element {
				return <WrappedComponent {...this.props} {...this.overrides} />
			}
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
