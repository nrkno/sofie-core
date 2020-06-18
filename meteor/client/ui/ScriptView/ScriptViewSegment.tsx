import * as React from 'react'
import { ContextMenuTrigger } from 'react-contextmenu'
import * as _ from 'underscore'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { withTracker, Translated } from '../../lib/ReactMeteorData/react-meteor-data'
import { Segments, SegmentId } from '../../../lib/collections/Segments'
import { Studio } from '../../../lib/collections/Studios'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { IOutputLayerExtended, ISourceLayerExtended, PartExtended, SegmentExtended } from '../../../lib/Rundown'
import { IContextMenuContext } from '../RundownView'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { SpeechSynthesiser } from '../../lib/speechSynthesis'
import { SegmentNote } from '../../../lib/api/notes'
import { PubSub } from '../../../lib/api/pubsub'
import { RundownUtils } from '../../lib/rundown'
import { PartInstanceId, PartInstances } from '../../../lib/collections/PartInstances'
import { Parts } from '../../../lib/collections/Parts'

import { ScriptViewPart } from './ScriptViewPart'
import { OutputGroups } from './ScriptView'
import { Piece } from '../../../lib/collections/Pieces'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { contextMenuHoldToDisplayTime } from '../../lib/lib'
import { literal } from '../../../lib/lib'

interface SegmentUi extends SegmentExtended {
	/** Output layers available in the installation used by this segment */
	outputLayers: {
		[key: string]: IOutputLayerUi
	}
	/** Source layers used by this segment */
	sourceLayers: {
		[key: string]: ISourceLayerUi
	}
}

interface PartUi extends PartExtended {}
interface IOutputLayerUi extends IOutputLayerExtended {
	/** Is output layer group collapsed */
	collapsed?: boolean
}
interface ISourceLayerUi extends ISourceLayerExtended {}
interface IProps {
	id: string
	segmentId: SegmentId
	studio: Studio
	showStyleBase: ShowStyleBase
	playlist: RundownPlaylist
	pieces: Piece[]
	adlibs: AdLibPiece[]
	activeLayerGroups: OutputGroups<boolean, boolean>
	isLastSegment: boolean
	isFirstSegment: boolean
	isQueuedSegment: boolean
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
}
interface IState {}
interface ITrackedProps {
	segmentui: SegmentUi | undefined
	parts: Array<PartUi>
	segmentNotes: Array<SegmentNote>
	currentLivePart: PartUi | undefined
	currentNextPart: PartUi | undefined
	hasRemoteItems: boolean
	hasGuestItems: boolean
	hasAlreadyPlayed: boolean
	autoNextPart: boolean
	lastValidPartIndex: number | undefined
	isNextSegment: boolean
	isLiveSegment: boolean
}
export const ScriptViewSegment = withTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());
	const segment = Segments.findOne(props.segmentId) as SegmentUi | undefined

	// console.log(`${props.segmentId}: running tracker`)

	// We need the segment to do anything
	if (!segment) {
		return {
			segmentui: undefined,
			parts: [],
			segmentNotes: [],
			currentLivePart: undefined,
			currentNextPart: undefined,
			hasRemoteItems: false,
			hasGuestItems: false,
			hasAlreadyPlayed: false,
			autoNextPart: false,
			lastValidPartIndex: undefined,
			isNextSegment: false,
			isLiveSegment: false,
		}
	}

	let o = RundownUtils.getResolvedSegment(props.showStyleBase, props.playlist, segment)
	let notes: Array<SegmentNote> = []
	_.each(o.parts, (part) => {
		notes = notes.concat(
			part.instance.part.getMinimumReactiveNotes(props.studio, props.showStyleBase),
			part.instance.part.getInvalidReasonNotes()
		)
	})
	notes = notes.concat(segment.notes || [])

	let lastValidPartIndex = o.parts.length - 1

	for (let i = lastValidPartIndex; i > 0; i--) {
		if (o.parts[i].instance.part.invalid) {
			lastValidPartIndex = i - 1
		} else {
			break
		}
	}

	return {
		segmentui: o.segmentExtended,
		parts: o.parts,
		segmentNotes: notes,
		currentLivePart: o.currentLivePart,
		currentNextPart: o.currentNextPart,
		hasAlreadyPlayed: o.hasAlreadyPlayed,
		hasRemoteItems: o.hasRemoteItems,
		hasGuestItems: o.hasGuestItems,
		autoNextPart: o.autoNextPart,
		lastValidPartIndex,
		isLiveSegment: o.isLiveSegment,
		isNextSegment: o.isNextSegment,
	}
})(
	class ScriptViewSegment extends MeteorReactComponent<Translated<IProps> & ITrackedProps, IState> {
		isLiveSegment: boolean
		isVisible: boolean
		rundownCurrentPartInstanceId: PartInstanceId | null

		constructor(props: IProps & ITrackedProps) {
			super(props)

			this.state = {}

			this.isLiveSegment = props.isLiveSegment || false
			this.isVisible = false
		}

		shouldComponentUpdate(nextProps: IProps & ITrackedProps, nextState: IState) {
			let result = !_.isMatch(this.props, nextProps) || !_.isMatch(this.state, nextState)
			return result
		}

		componentWillMount() {
			this.subscribe(PubSub.segments, {
				_id: this.props.segmentId,
			})
			this.subscribe(PubSub.parts, {
				segmentId: this.props.segmentId,
			})
			this.subscribe(PubSub.partInstances, {
				segmentId: this.props.segmentId,
				reset: {
					$ne: true,
				},
			})
			this.autorun(() => {
				const partIds = Parts.find({
					segmentId: this.props.segmentId,
				}).map((part) => part._id)

				const partInstanceIds = PartInstances.find({
					segmentId: this.props.segmentId,
				}).map((instance) => instance._id)

				this.subscribe(PubSub.pieces, {
					partId: {
						$in: partIds,
					},
				})

				this.subscribe(PubSub.adLibPieces, {
					partId: {
						$in: partIds,
					},
				})

				this.subscribe(PubSub.pieceInstances, {
					partInstanceId: {
						$in: partInstanceIds,
					},
					reset: {
						$ne: true,
					},
				})
			})
			SpeechSynthesiser.init()
		}

		componentDidMount() {
			this.rundownCurrentPartInstanceId = this.props.playlist.currentPartInstanceId
		}

		componentDidUpdate(prevProps: IProps & ITrackedProps) {}

		componentWillUnmount() {
			this._cleanUp()
		}

		getStatusClass() {
			const SEGMENT_VIEW = 'segment-script-view'

			if (this.props.isLiveSegment) {
				return SEGMENT_VIEW + ' live'
			} else if (this.props.isNextSegment) {
				return SEGMENT_VIEW + ' next'
			} else if (this.props.isQueuedSegment) {
				return SEGMENT_VIEW + ' queued'
			}

			return SEGMENT_VIEW
		}

		getSegmentContext = () => {
			const ctx = literal<IContextMenuContext>({
				segment: this.props.segmentui,
				part: this.props.parts.length > 0 ? this.props.parts[0] : null,
			})

			if (this.props.onContextMenu && typeof this.props.onContextMenu === 'function') {
				this.props.onContextMenu(ctx)
			}

			return ctx
		}

		render() {
			return (
				<div className={this.getStatusClass()}>
					{/* <ContextMenuTrigger
						id="segment-timeline-context-menu"
						collect={this.getSegmentContext}
						attributes={{
							className: 'segment-script-view__title',
						}}
						holdToDisplay={contextMenuHoldToDisplayTime()}
						renderTag="div">
						{this.props.segmentui && <h2>{this.props.segmentui.name}</h2>}
					</ContextMenuTrigger> */}
					<div className="segment-script-view__title">
						{this.props.segmentui && <h2>{this.props.segmentui.name}</h2>}
					</div>
					<div className="segment-script-view__grid">
						{this.props.parts.map((part, index, arr) => (
							<ScriptViewPart
								key={'segment__' + this.props.segmentId + '__part__' + part.partId}
								segment={this.props.segmentui}
								playlist={this.props.playlist}
								studio={this.props.studio}
								showStyleBase={this.props.showStyleBase}
								part={part}
								pieces={this.props.pieces}
								adlibs={this.props.adlibs}
								isLastSegment={this.props.isLastSegment}
								isFirstInFirstSegment={this.props.isFirstSegment && index === 0}
								isLastInSegment={index === arr.length - 1}
								activeLayerGroups={this.props.activeLayerGroups}
							/>
						))}
					</div>
				</div>
			)
		}
	}
)
