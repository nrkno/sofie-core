import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { PieceUi } from './SegmentTimelineContainer'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { PubSub } from '../../../lib/api/pubsub'
import { RundownUtils } from '../../lib/rundown'
import { checkPieceContentStatus, getMediaObjectMediaId } from '../../../lib/mediaObjects'
import { Studio } from '../../../lib/collections/Studios'
import { IAdLibListItem } from '../Shelf/AdLibListItem'
import { BucketAdLibUi, BucketAdLibActionUi } from '../Shelf/RundownViewBuckets'
import { literal } from '../../../lib/lib'
import { ExpectedPackageId, getExpectedPackageId } from '../../../lib/collections/ExpectedPackages'
import * as _ from 'underscore'
import { MongoSelector } from '../../../lib/typings/meteor'
import { PackageInfoDB } from '../../../lib/collections/PackageInfos'
import { AdLibPieceUi } from '../../lib/shelf'

type AnyPiece = {
	piece?: BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi | BucketAdLibActionUi | undefined
	layer?: ISourceLayer | undefined
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

			private expectedPackageIds: ExpectedPackageId[] = []
			private subPackageInfos: Meteor.SubscriptionHandle | undefined

			private updateMediaObjectSubscription() {
				if (this.destroyed) return

				const layer = this.props.piece?.sourceLayer || (this.props.layer as ISourceLayer | undefined)

				if (this.props.piece && layer) {
					const piece = WithMediaObjectStatusHOCComponent.unwrapPieceInstance(this.props.piece!)
					const objId: string | undefined = getMediaObjectMediaId(piece, layer)

					if (objId && objId !== this.objId && this.props.studio) {
						if (this.subscription) this.subscription.stop()
						this.objId = objId
						this.subscription = this.subscribe(PubSub.mediaObjects, this.props.studio._id, {
							mediaId: this.objId,
						})
					} else if (!objId && objId !== this.objId) {
						if (this.subscription) this.subscription.stop()
						this.subscription = undefined
					}
				}

				if (this.props.piece) {
					const piece = WithMediaObjectStatusHOCComponent.unwrapPieceInstance(this.props.piece!)

					const expectedPackageIds: ExpectedPackageId[] = []
					if (piece.expectedPackages) {
						for (let i = 0; i < piece.expectedPackages.length; i++) {
							const expectedPackage = piece.expectedPackages[i]
							const id = expectedPackage._id || '__unnamed' + i

							expectedPackageIds.push(getExpectedPackageId(piece._id, id))
						}
					}
					if (this.props.studio) {
						if (!_.isEqual(this.expectedPackageIds, expectedPackageIds)) {
							this.expectedPackageIds = expectedPackageIds

							if (this.subPackageInfos) {
								this.subPackageInfos.stop()
								delete this.subPackageInfos
							}
							if (this.expectedPackageIds.length) {
								this.subPackageInfos = this.subscribe(
									PubSub.packageInfos,
									literal<MongoSelector<PackageInfoDB>>({
										studioId: this.props.studio._id,
										packageId: { $in: this.expectedPackageIds },
									})
								)
							}
						}
					}
				}
			}

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
						const { metadata, packageInfos, status, contentDuration, message } = checkPieceContentStatus(
							WithMediaObjectStatusHOCComponent.unwrapPieceInstance(piece!),
							piece.sourceLayer || layer,
							studio
						)
						if (RundownUtils.isAdLibPieceOrAdLibListItem(piece!)) {
							if (status !== piece.status || metadata || packageInfos) {
								// Deep clone the required bits
								const origPiece = (overrides.piece || this.props.piece) as AdLibPieceUi
								const pieceCopy: AdLibPieceUi = {
									...(origPiece as AdLibPieceUi),
									status: status,
									contentMetaData: metadata,
									contentPackageInfos: packageInfos,
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
							if (status !== piece.instance.piece.status || metadata || packageInfos) {
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
									contentPackageInfos: packageInfos,
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
				if (this.subscription) {
					this.subscription.stop()
					delete this.subscription
				}
				if (this.subPackageInfos) {
					this.subPackageInfos.stop()
					delete this.subPackageInfos
				}
				super.componentWillUnmount()
			}

			render() {
				return <WrappedComponent {...this.props} {...this.overrides} />
			}
		}
	}
}
