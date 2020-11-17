import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { PieceUi } from './SegmentTimelineContainer'
import { AdLibPieceUi } from '../Shelf/AdLibPanel'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { SourceLayerType, VTContent, LiveSpeakContent } from '@sofie-automation/blueprints-integration'
import { PubSub } from '../../../lib/api/pubsub'
import { RundownUtils } from '../../lib/rundown'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { Studio } from '../../../lib/collections/Studios'
import { IAdLibListItem } from '../Shelf/AdLibListItem'
import { BucketAdLibUi } from '../Shelf/RundownViewBuckets'

type AnyPiece = {
	piece: BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi | undefined
	isLiveLine?: boolean
	studio: Studio | undefined
}

type IWrappedComponent<IProps extends AnyPiece, IState> = new (props: IProps, state: IState) => React.Component<
	IProps,
	IState
>

export function withMediaObjectStatus<IProps extends AnyPiece, IState>(): (
	WrappedComponent: IWrappedComponent<IProps, IState> | React.FC<IProps>
) => new (props: IProps, context: any) => React.Component<IProps, IState> {
	return (WrappedComponent) => {
		return class WithMediaObjectStatusHOCComponent extends MeteorReactComponent<IProps, IState> {
			private statusComp: Tracker.Computation
			private objId: string
			private overrides: Partial<IProps>
			private destroyed: boolean
			private subscription: Meteor.SubscriptionHandle | undefined

			private updateMediaObjectSubscription() {
				if (this.destroyed) return

				if (this.props.piece && this.props.piece.sourceLayer) {
					const piece = WithMediaObjectStatusHOCComponent.unwrapPieceInstance(this.props.piece!)
					let objId: string | undefined = undefined

					switch (this.props.piece.sourceLayer.type) {
						case SourceLayerType.VT:
							objId = piece.content ? (piece.content as VTContent).fileName?.toUpperCase() : undefined
							break
						case SourceLayerType.LIVE_SPEAK:
							objId = piece.content ? (piece.content as LiveSpeakContent).fileName?.toUpperCase() : undefined
							break
					}

					if (this.subscription) this.subscription.stop()

					if (objId && objId !== this.objId && this.props.studio) {
						// if (this.mediaObjectSub) this.mediaObjectSub.stop()
						this.objId = objId
						this.subscription = this.subscribe(PubSub.mediaObjects, this.props.studio._id, {
							mediaId: this.objId,
						})
					}
				}
			}

			private shouldDataTrackerUpdate(prevProps: IProps): boolean {
				if (this.props.piece !== prevProps.piece) return true
				if (this.props.studio !== prevProps.studio) return true
				if (this.props.isLiveLine !== prevProps.isLiveLine) return true
				return false
			}

			private static unwrapPieceInstance(piece: BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi) {
				if (RundownUtils.isPieceInstance(piece)) {
					return piece.instance.piece
				} else {
					return piece
				}
			}

			updateDataTracker() {
				if (this.destroyed) return

				this.statusComp = this.autorun(() => {
					const { piece, studio } = this.props
					this.overrides = {}
					const overrides = this.overrides

					// Check item status
					if (piece && piece.sourceLayer && studio) {
						const { metadata, status, contentDuration, message } = checkPieceContentStatus(
							WithMediaObjectStatusHOCComponent.unwrapPieceInstance(piece!),
							piece.sourceLayer,
							studio.settings
						)
						if (RundownUtils.isAdLibPieceOrAdLibListItem(piece!)) {
							if (status !== piece.status || metadata) {
								// Deep clone the required bits
								const origPiece = (overrides.piece || this.props.piece) as AdLibPieceUi
								const pieceCopy: AdLibPieceUi = {
									...((overrides.piece || this.props.piece) as AdLibPieceUi),
									status: status,
									contentMetaData: metadata,
									message,
								}

								if (
									pieceCopy.content &&
									pieceCopy.content.sourceDuration === undefined &&
									contentDuration !== undefined
								) {
									pieceCopy.content.sourceDuration = contentDuration
								}

								overrides.piece = {
									...pieceCopy,
								}
							}
						} else {
							if (status !== piece.instance.piece.status || metadata) {
								// Deep clone the required bits
								const origPiece = (overrides.piece || piece) as PieceUi
								const pieceCopy: PieceUi = {
									...((overrides.piece || piece) as PieceUi),
									instance: {
										...origPiece.instance,
										piece: {
											...origPiece.instance.piece,
											status: status,
										},
									},
									contentMetaData: metadata,
									message,
								}

								if (
									pieceCopy.instance.piece.content &&
									pieceCopy.instance.piece.content.sourceDuration === undefined &&
									contentDuration !== undefined
								) {
									pieceCopy.instance.piece.content.sourceDuration = contentDuration
								}

								overrides.piece = {
									...pieceCopy,
								}
							}
						}
					} else {
						console.error(`Piece has no sourceLayer:`, piece)
					}

					this.forceUpdate()
				})
			}

			componentDidMount() {
				window.requestIdleCallback(
					() => {
						this.updateMediaObjectSubscription()
						this.updateDataTracker()
					},
					{
						timeout: 500,
					}
				)
			}

			componentDidUpdate(prevProps: IProps) {
				Meteor.defer(() => {
					this.updateMediaObjectSubscription()
				})
				if (this.shouldDataTrackerUpdate(prevProps)) {
					if (this.statusComp) this.statusComp.invalidate()
				}
			}

			componentWillUnmount() {
				this.destroyed = true
				super.componentWillUnmount()
			}

			render() {
				return <WrappedComponent {...this.props} {...this.overrides} />
			}
		}
	}
}
