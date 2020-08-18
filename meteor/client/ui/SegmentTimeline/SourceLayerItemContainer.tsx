import * as React from 'react'
import * as _ from 'underscore'
import { Timeline } from '../../../lib/collections/Timeline'
import { SourceLayerItem } from './SourceLayerItem'
import { getCurrentTime, unprotectObject } from '../../../lib/lib'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import {
	SourceLayerType,
	VTContent,
	LiveSpeakContent,
	GraphicsContent,
	getPieceGroupId,
} from 'tv-automation-sofie-blueprints-integration'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
// @ts-ignore Meteor package not recognized by Typescript
import { ComputedField } from 'meteor/peerlibrary:computed-field'
import { Meteor } from 'meteor/meteor'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import { ISourceLayerUi, IOutputLayerUi, SegmentUi, PartUi, PieceUi } from './SegmentTimelineContainer'
import { Tracker } from 'meteor/tracker'
import { PubSub } from '../../../lib/api/pubsub'

interface IPropsHeader {
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	mediaPreviewUrl: string
	// segment: SegmentUi
	part: PartUi
	partStartsAt: number
	partDuration: number
	piece: PieceUi
	playlist: RundownPlaylist
	timeScale: number
	isLiveLine: boolean
	isNextLine: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	onClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	relative?: boolean
	outputGroupCollapsed: boolean
	followLiveLine: boolean
	autoNextPart: boolean
	liveLineHistorySize: number
	livePosition: number | null
	liveLinePadding: number
	scrollLeft: number
	scrollWidth: number
}
/** This is a container component that allows ractivity with the Timeline collection */
export const SourceLayerItemContainer = class SourceLayerItemContainer extends MeteorReactComponent<IPropsHeader> {
	private mediaObjectSub: Meteor.SubscriptionHandle
	private statusComp: Tracker.Computation
	private objId: string
	private overrides: Partial<IPropsHeader>
	private destroyed: boolean

	updateMediaObjectSubscription() {
		if (this.destroyed) return

		if (this.props.piece && this.props.piece.sourceLayer) {
			const piece = this.props.piece
			let objId: string | undefined = undefined

			switch (this.props.piece.sourceLayer.type) {
				case SourceLayerType.VT:
					objId = piece.instance.piece.content
						? (piece.instance.piece.content as VTContent).fileName?.toUpperCase()
						: undefined
					break
				case SourceLayerType.LIVE_SPEAK:
					objId = piece.instance.piece.content
						? (piece.instance.piece.content as LiveSpeakContent).fileName?.toUpperCase()
						: undefined
					break
				/*case SourceLayerType.GRAPHICS:
					objId = piece.instance.piece.content
						? (piece.instance.piece.content as GraphicsContent).fileName?.toUpperCase()
						: undefined
					break*/
			}

			if (objId && objId !== this.objId) {
				// if (this.mediaObjectSub) this.mediaObjectSub.stop()
				this.objId = objId
				this.subscribe(PubSub.mediaObjects, this.props.playlist.studioId, {
					mediaId: this.objId,
				})
			}
		}
	}

	shouldDataTrackerUpdate(prevProps: IPropsHeader): boolean {
		if (this.props.piece !== prevProps.piece) return true
		if (this.props.isLiveLine !== prevProps.isLiveLine) return true
		return false
	}

	updateDataTracker() {
		if (this.destroyed) return

		this.statusComp = this.autorun(() => {
			const props = this.props
			this.overrides = {}
			const overrides = this.overrides

			// Check item status
			if (props.piece.sourceLayer) {
				const { metadata, status, contentDuration, message } = checkPieceContentStatus(
					props.piece.instance.piece,
					props.piece.sourceLayer,
					props.playlist.getStudio().settings
				)
				if (status !== props.piece.instance.piece.status || metadata) {
					// Deep clone the required bits
					const origPiece = (overrides.piece || props.piece) as PieceUi
					const pieceCopy: PieceUi = {
						...(overrides.piece || props.piece),
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

					overrides.piece = _.extend(overrides.piece || {}, pieceCopy)
				}
			} else {
				console.error(`Piece "${props.piece.instance.piece._id}" has no sourceLayer:`, props.piece)
			}

			this.forceUpdate()
		})
	}

	componentDidMount() {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
			this.updateDataTracker()
		})
	}

	componentDidUpdate(prevProps: IPropsHeader) {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
		if (this.shouldDataTrackerUpdate(prevProps)) {
			// console.log('Invalidating computation!', this.statusComp.stopped, this.statusComp.invalidated)
			if (this.statusComp) this.statusComp.invalidate()
		}
	}

	componentWillUnmount() {
		this.destroyed = true
		super.componentWillUnmount()
	}

	render() {
		return <SourceLayerItem {...this.props} {...this.overrides} />
	}
}
