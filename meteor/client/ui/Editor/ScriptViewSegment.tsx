import * as React from 'react'
import * as _ from 'underscore'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { withTracker, Translated } from '../../lib/ReactMeteorData/react-meteor-data'
import { Segments, SegmentId } from '../../../lib/collections/Segments'
import { Studio } from '../../../lib/collections/Studios'
import { UIStateStorage } from '../../lib/UIStateStorage'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import {
	IOutputLayerExtended,
	ISourceLayerExtended,
	PieceExtended,
	PartExtended,
	SegmentExtended,
} from '../../../lib/Rundown'
import { IContextMenuContext } from '../RundownView'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { SpeechSynthesiser } from '../../lib/speechSynthesis'
import { NoteType, SegmentNote } from '../../../lib/api/notes'
import { PubSub } from '../../../lib/api/pubsub'
import { RundownUtils } from '../../lib/rundown'
import { Settings } from '../../../lib/Settings'
import { PartInstanceId, PartInstances } from '../../../lib/collections/PartInstances'
import { Parts } from '../../../lib/collections/Parts'

import { ScriptViewPart } from './ScriptViewPart'
import { OutputGroups } from './ScriptView'

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
interface PieceUi extends PieceExtended {
	/** This item has already been linked to the parent item of the spanning item group */
	linked?: boolean
	/** Metadata object */
	contentMetaData?: any
	message?: string | null
}
interface IProps {
	id: string
	segmentId: SegmentId
	studio: Studio
	showStyleBase: ShowStyleBase
	playlist: RundownPlaylist
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onTimeScaleChange?: (timeScaleVal: number) => void
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	onSegmentScroll?: () => void
	onHeaderNoteClick?: (level: NoteType) => void
	segmentRef?: (el: React.ComponentClass, sId: string) => void
	isLastSegment: boolean
	activeLayerGroups: OutputGroups<boolean>
}
interface IState {
	scrollLeft: number
	collapsedOutputs: {
		[key: string]: boolean
	}
	collapsed: boolean
	followLiveLine: boolean
	livePosition: number
	displayTimecode: number
	autoExpandCurrentNextSegment: boolean
}
interface ITrackedProps {
	segmentui: SegmentUi | undefined
	parts: Array<PartUi>
	segmentNotes: Array<SegmentNote>
	isLiveSegment: boolean
	isNextSegment: boolean
	currentLivePart: PartUi | undefined
	currentNextPart: PartUi | undefined
	hasRemoteItems: boolean
	hasGuestItems: boolean
	hasAlreadyPlayed: boolean
	autoNextPart: boolean
	lastValidPartIndex: number | undefined
}
export const ScriptViewSegment = withTracker<IProps, IState, ITrackedProps>(
	(props: IProps) => {
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
				isLiveSegment: false,
				isNextSegment: false,
				currentLivePart: undefined,
				currentNextPart: undefined,
				hasRemoteItems: false,
				hasGuestItems: false,
				hasAlreadyPlayed: false,
				autoNextPart: false,
				lastValidPartIndex: undefined,
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
			isLiveSegment: o.isLiveSegment,
			currentLivePart: o.currentLivePart,
			currentNextPart: o.currentNextPart,
			isNextSegment: o.isNextSegment,
			hasAlreadyPlayed: o.hasAlreadyPlayed,
			hasRemoteItems: o.hasRemoteItems,
			hasGuestItems: o.hasGuestItems,
			autoNextPart: o.autoNextPart,
			lastValidPartIndex,
		}
	},
	(data: ITrackedProps, props: IProps, nextProps: IProps): boolean => {
		// This is a potentailly very dangerous hook into the React component lifecycle. Re-use with caution.
		// Check obvious primitive changes
		if (
			props.onContextMenu !== nextProps.onContextMenu ||
			props.onSegmentScroll !== nextProps.onSegmentScroll ||
			props.onTimeScaleChange !== nextProps.onTimeScaleChange ||
			props.segmentId !== nextProps.segmentId ||
			props.segmentRef !== nextProps.segmentRef
		) {
			return true
		}
		// Check rundown changes that are important to the segment
		if (
			typeof props.playlist !== typeof nextProps.playlist ||
			(props.playlist.nextSegmentId !== nextProps.playlist.nextSegmentId &&
				(props.playlist.nextSegmentId === props.segmentId || nextProps.playlist.nextSegmentId === props.segmentId)) ||
			((props.playlist.currentPartInstanceId !== nextProps.playlist.currentPartInstanceId ||
				props.playlist.nextPartInstanceId !== nextProps.playlist.nextPartInstanceId) &&
				data.parts &&
				(data.parts.find(
					(i) =>
						i.instance._id === props.playlist.currentPartInstanceId ||
						i.instance._id === nextProps.playlist.currentPartInstanceId
				) ||
					data.parts.find(
						(i) =>
							i.instance._id === props.playlist.nextPartInstanceId ||
							i.instance._id === nextProps.playlist.nextPartInstanceId
					))) ||
			props.playlist.holdState !== nextProps.playlist.holdState
		) {
			return true
		}
		// Check studio installation changes that are important to the segment.
		// We also could investigate just skipping this and requiring a full reload if the studio installation is changed
		if (
			typeof props.studio !== typeof nextProps.studio ||
			!_.isEqual(props.studio.settings, nextProps.studio.settings) ||
			!_.isEqual(props.studio.config, nextProps.studio.config) ||
			!_.isEqual(props.showStyleBase.config, nextProps.showStyleBase.config) ||
			!_.isEqual(props.showStyleBase.sourceLayers, nextProps.showStyleBase.sourceLayers) ||
			!_.isEqual(props.showStyleBase.outputLayers, nextProps.showStyleBase.outputLayers)
		) {
			return true
		}

		return false
	},
	true
)(
	class ScriptViewSegment extends MeteorReactComponent<Translated<IProps> & ITrackedProps, IState> {
		isLiveSegment: boolean
		isVisible: boolean
		rundownCurrentPartInstanceId: PartInstanceId | null

		constructor(props: IProps & ITrackedProps) {
			super(props)

			this.state = {
				collapsedOutputs: UIStateStorage.getItemBooleanMap(
					`rundownView.${this.props.playlist._id}`,
					`segment.${props.segmentId}.outputs`,
					{}
				),
				collapsed: UIStateStorage.getItemBoolean(
					`rundownView.${this.props.playlist._id}`,
					`segment.${props.segmentId}`,
					!!Settings.defaultToCollapsedSegments
				),
				scrollLeft: 0,
				followLiveLine: false,
				livePosition: 0,
				displayTimecode: 0,
				autoExpandCurrentNextSegment: !!Settings.autoExpandCurrentNextSegment,
			}

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

		render() {
			return (
				<div>
					<div className="segment-script-view">
						<div className="segment-script-view__title">
							{this.props.segmentui && (
								<h2 className="segment-script-view__title__label">{this.props.segmentui.name}</h2>
							)}
						</div>
						<div className="segment-script-view__grid">
							{this.props.parts.map((part) => (
								<ScriptViewPart
									key={'segment__' + this.props.segmentId + '__part__' + part.partId}
									segment={this.props.segmentui}
									playlist={this.props.playlist}
									studio={this.props.studio}
									showStyleBase={this.props.showStyleBase}
									part={part}
									isLastSegment={false}
									isLastInSegment={false}
									activeLayerGroups={this.props.activeLayerGroups}
								/>
							))}
						</div>
					</div>
				</div>
			)
		}
	}
)
