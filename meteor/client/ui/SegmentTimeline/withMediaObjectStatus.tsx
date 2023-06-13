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
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceContentStatusObj } from '../../../lib/mediaObjects'
import { deepFreeze } from '@sofie-automation/corelib/dist/lib'
import _ from 'underscore'

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
	contentDuration: undefined,

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

			updateDataTracker() {
				if (this.destroyed) return

				this.statusComp = this.autorun(() => {
					const { piece, studio, layer } = this.props
					this.overrides = {}
					const overrides = this.overrides

					// Check item status
					if (piece && (piece.sourceLayer || layer) && studio) {
						const pieceUnwrapped = WithMediaObjectStatusHOCComponent.unwrapPieceInstance(piece)
						const statusDoc = RundownUtils.isBucketAdLibItem(piece)
							? UIBucketContentStatuses.findOne({
									bucketId: piece.bucketId,
									docId: pieceUnwrapped._id,
							  })
							: UIPieceContentStatuses.findOne({
									// Future: It would be good for this to be stricter.
									pieceId: pieceUnwrapped._id,
							  })

						// Extract the status or populate some default values
						const statusObj = statusDoc?.status ?? DEFAULT_STATUS

						if (RundownUtils.isAdLibPieceOrAdLibListItem(piece)) {
							if (!overrides.piece || !_.isEqual(statusObj, (overrides.piece as AdLibPieceUi).contentStatus)) {
								// Deep clone the required bits
								const origPiece = (overrides.piece || this.props.piece) as AdLibPieceUi
								const pieceCopy: AdLibPieceUi = {
									...(origPiece as AdLibPieceUi),

									contentStatus: statusObj,
								}

								if (
									pieceCopy.content &&
									pieceCopy.content.sourceDuration === undefined &&
									statusObj.contentDuration !== undefined
								) {
									pieceCopy.content.sourceDuration = statusObj.contentDuration
								}

								overrides.piece = {
									...pieceCopy,
								}
							}
						} else {
							if (!overrides.piece || !_.isEqual(statusObj, (overrides.piece as PieceUi).contentStatus)) {
								// Deep clone the required bits
								const pieceCopy: PieceUi = {
									...((overrides.piece || piece) as PieceUi),

									contentStatus: statusObj,
								}

								if (
									pieceCopy.instance.piece.content &&
									pieceCopy.instance.piece.content.sourceDuration === undefined &&
									statusObj.contentDuration !== undefined
								) {
									pieceCopy.instance.piece.content.sourceDuration = statusObj.contentDuration
								}

								overrides.piece = {
									...pieceCopy,
								}
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
