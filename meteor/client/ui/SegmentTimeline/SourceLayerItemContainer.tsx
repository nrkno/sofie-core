import * as React from 'react'
import * as _ from 'underscore'
import { Timeline } from '../../../lib/collections/Timeline'
import { SourceLayerItem } from './SourceLayerItem'
import { getCurrentTime } from '../../../lib/lib'
import { Rundown } from '../../../lib/collections/Rundowns'
import { SourceLayerType, VTContent, LiveSpeakContent, getPieceGroupId, GraphicsContent } from 'tv-automation-sofie-blueprints-integration'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
// @ts-ignore Meteor package not recognized by Typescript
import { ComputedField } from 'meteor/peerlibrary:computed-field'
import { Meteor } from 'meteor/meteor'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import {
	ISourceLayerUi,
	IOutputLayerUi,
	SegmentUi,
	PartUi,
	PieceUi
} from './SegmentTimelineContainer'
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
	rundown: Rundown
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
export const SourceLayerItemContainer = class extends MeteorReactComponent<IPropsHeader> {
	private mediaObjectSub: Meteor.SubscriptionHandle
	private statusComp: Tracker.Computation
	private objId: string
	private overrides: any
	private destroyed: boolean

	updateMediaObjectSubscription () {
		if (this.destroyed) return

		if (this.props.piece && this.props.piece.sourceLayer) {
			const piece = this.props.piece
			let objId: string | undefined = undefined

			if (piece.content) {
				switch (this.props.layer.type) {
					case SourceLayerType.VT:
						objId = (piece.content as VTContent).fileName.toUpperCase()
						break
					case SourceLayerType.LIVE_SPEAK:
						objId = (piece.content as LiveSpeakContent).fileName.toUpperCase()
						break
					case SourceLayerType.GRAPHICS:
						if (piece.content.fileName) {
							objId = (piece.content as GraphicsContent).fileName.toUpperCase()
						}
						break
				}
			}

			if (objId && objId !== this.objId) {
				// if (this.mediaObjectSub) this.mediaObjectSub.stop()
				this.objId = objId
				this.subscribe(PubSub.mediaObjects, this.props.rundown.studioId, {
					mediaId: this.objId
				})
			}
		} else {
			console.error('One of the Piece\'s is invalid:', this.props.piece)
		}
	}

	shouldDataTrackerUpdate (prevProps: IPropsHeader): boolean {
		if (this.props.piece !== prevProps.piece) return true
		if (this.props.isLiveLine !== prevProps.isLiveLine) return true
		return false
	}

	updateDataTracker () {
		if (this.destroyed) return

		this.statusComp = this.autorun(() => {
			const props = this.props
			this.overrides = {}
			const overrides = this.overrides

			// console.log(`${this.props.piece._id}: running data tracker`)

			if (props.isLiveLine) {
				// Check in Timeline collection for any changes to the related object
				// TODO - this query appears to be unable to load any data
				let timelineObj = Timeline.findOne({ id: getPieceGroupId(props.piece) })

				if (timelineObj) {
					let pieceCopy = (_.clone(overrides.piece || props.piece) as PieceUi)

					pieceCopy.enable = timelineObj.enable
					if (_.isNumber(timelineObj.enable.start)) { // this is a normal absolute trigger value
						pieceCopy.renderedInPoint = timelineObj.enable.start
					} else if (timelineObj.enable.start === 'now') { // this is a special absolute trigger value
						if (props.part && props.part.startedPlayback && props.part.getLastStartedPlayback()) {
							pieceCopy.renderedInPoint = getCurrentTime() - (props.part.getLastStartedPlayback() || 0)
						} else {
							pieceCopy.renderedInPoint = 0
						}
					} else {
						pieceCopy.renderedInPoint = 0
					}

					if (typeof timelineObj.enable.duration === 'number' && !pieceCopy.cropped) {
						pieceCopy.renderedDuration = (
							timelineObj.enable.duration !== 0 ?
							timelineObj.enable.duration :
							(props.partDuration - (pieceCopy.renderedInPoint || 0))
						) || null
					}
					// console.log(segmentCopy.renderedDuration)

					overrides.piece = _.extend(overrides.piece || {}, pieceCopy)
				}
			}

			// Check item status
			if (props.piece.sourceLayer) {

				const { metadata, status, contentDuration } = checkPieceContentStatus(props.piece, props.piece.sourceLayer, props.rundown.getStudio().settings)
				if (status !== props.piece.status || metadata) {
					let pieceCopy = (_.clone(overrides.piece || props.piece) as PieceUi)

					pieceCopy.status = status
					pieceCopy.contentMetaData = metadata
					
					if (
						pieceCopy.content &&
						pieceCopy.content.sourceDuration === undefined &&
						contentDuration !== undefined
					) {
						pieceCopy.content.sourceDuration = contentDuration
					}

					overrides.piece = _.extend(overrides.piece || {}, pieceCopy)
				}
			} else {
				console.error(`Piece "${props.piece._id}" has no sourceLayer:`, props.piece)
			}

			this.forceUpdate()
		})
	}

	componentDidMount () {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
			this.updateDataTracker()
		})
	}

	componentDidUpdate (prevProps: IPropsHeader) {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
		if (this.shouldDataTrackerUpdate(prevProps)) {
			// console.log('Invalidating computation!', this.statusComp.stopped, this.statusComp.invalidated)
			if (this.statusComp) this.statusComp.invalidate()
		}
	}

	componentWillUnmount () {
		this.destroyed = true
		super.componentWillUnmount()
	}

	render () {
		return (
			<SourceLayerItem {...this.props} {...this.overrides} />
		)
	}
}
