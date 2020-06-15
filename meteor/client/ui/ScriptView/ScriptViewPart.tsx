import * as React from 'react'
import { translate } from 'react-i18next'

import * as ClassNames from 'classnames'
import * as _ from 'underscore'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Rundown } from '../../../lib/collections/Rundowns'
import { Studio } from '../../../lib/collections/Studios'
import { SegmentUi, IOutputLayerUi, ISourceLayerUi, PieceUi, PartUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { RundownTiming, WithTiming, withTiming } from '../RundownView/RundownTiming'

import { ContextMenuTrigger } from 'react-contextmenu'

import { RundownUtils } from '../../lib/rundown'
import { getCurrentTime, literal, unprotectString } from '../../../lib/lib'
import { ensureHasTrailingSlash, contextMenuHoldToDisplayTime } from '../../lib/lib'

import { Translated, withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { ConfigItemValue, SourceLayerType } from 'tv-automation-sofie-blueprints-integration'

import { getElementDocumentOffset, OffsetPosition } from '../../utils/positions'
import { IContextMenuContext } from '../RundownView'
import { SegmentNote } from '../../../lib/api/notes'
import { Segments } from '../../../lib/collections/Segments'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'
import { Pieces, Piece } from '../../../lib/collections/Pieces'
import { Parts } from '../../../lib/collections/Parts'
import { EditAttribute } from '../../lib/EditAttribute'
import { faBookOpen } from '@fortawesome/fontawesome-free-solid'
import { PartExtended, PieceExtended } from '../../../lib/Rundown'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { LayerGroups, OutputGroups } from './ScriptView'
import { FloatingInspector } from '../FloatingInspector'

interface IProps {
	segment: SegmentUi | undefined
	playlist: RundownPlaylist
	studio: Studio
	part: PartUi
	pieces: Piece[]
	showStyleBase: ShowStyleBase
	totalSegmentDuration?: number
	firstPartInSegment?: PartUi
	isLastInSegment: boolean
	isLastSegment: boolean
	activeLayerGroups: OutputGroups<boolean>
}

interface IState {
	isLive: boolean
	isNext: boolean
	isDurationSettling: boolean

	isInsideViewport: boolean
}

interface ITrackedProps {
	segmentui: SegmentUi | undefined
}

export const ScriptViewPart = withTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	let segmentui: SegmentUi | undefined
	if (props.segment) {
		segmentui = Segments.findOne(props.segment._id) as SegmentUi | undefined
	}

	if (!segmentui)
		return {
			segmentui: undefined,
		}

	return {
		segmentui,
	}
})(
	class ScriptViewPart0 extends MeteorReactComponent<Translated<IProps> & ITrackedProps, IState> {
		private delayedInstanceUpdate: NodeJS.Timer | undefined

		constructor(props: IProps & ITrackedProps) {
			super(props)

			const partInstance = this.props.part.instance

			const isLive = this.props.playlist.currentPartInstanceId === partInstance._id
			const isNext = this.props.playlist.nextPartInstanceId === partInstance._id
			const startedPlayback = partInstance.part.startedPlayback

			this.state = {
				isLive,
				isNext,
				isDurationSettling: false,
				isInsideViewport: false,
			}
		}

		componentWillMount() {
			if (this.props.segment) {
				const partIds = Parts.find({
					segmentId: this.props.segment._id,
				}).map((part) => part._id)

				this.subscribe(PubSub.pieces, {
					partId: this.props.part.partId,
				})

				this.autorun(() => {
					this.subscribe(PubSub.pieces, {
						partId: {
							$in: partIds,
						},
					})
				})
			}
		}

		shouldComponentUpdate(nextProps: IProps & ITrackedProps, nextState: IState) {
			console.log(nextProps.activeLayerGroups, this.props.activeLayerGroups)

			let result = !_.isMatch(this.props, nextProps) || !_.isMatch(this.state, nextState)
			return result
		}

		renderScripts() {
			let scriptPieces: Array<PieceExtended> = []
			scriptPieces = this.props.part.pieces.filter(
				(p) => p.instance.piece.content && p.instance.piece.content.fullScript
			)

			if (scriptPieces.length == 0) {
				return <div className="script-view-script__pieces" />
			}

			return (
				<div className="script-view-script__pieces">
					{scriptPieces.map((sp) => (
						<div
							key={'part_' + this.props.part.partId + '_scriptpiece_' + sp.instance._id}
							className="script-view-script___piece">
							{sp.instance.piece.content && <p>{sp.instance.piece.content.fullScript}</p>}
						</div>
					))}
				</div>
			)
		}

		getLayerClass(piece: Piece) {
			const layer = this.props.showStyleBase.sourceLayers.find((sl) => sl._id == piece.sourceLayerId)

			if (layer) return RundownUtils.getSourceLayerClassName(layer.type)

			return RundownUtils.getSourceLayerClassName(SourceLayerType.UNKNOWN)
		}

		sortPieces() {
			const pieces = this.props.part.instance.part.getPieces()

			let layerGroups: OutputGroups<Piece[]> = {}

			if (this.props.studio && this.props.showStyleBase) {
				const layerIdtoLayerType = (type: string): SourceLayerType => {
					if (this.props.showStyleBase) {
						const layer = this.props.showStyleBase.sourceLayers.find((sl) => sl._id == type)

						if (layer) {
							return layer.type
						}
					}

					return SourceLayerType.UNKNOWN
				}

				let displayedHeaders = Object.keys(this.props.activeLayerGroups).filter(
					(output) => Object.values(this.props.activeLayerGroups[output]).filter((layer) => layer).length > 0
				)

				for (const output of displayedHeaders) {
					layerGroups[output] = {
						primary: [],
						overlays: [],
						audio: [],
						other: [],
						adlib: [],
					}

					const outputLayerId = this.props.showStyleBase.outputLayers.find((op) => op.name == output)

					if (outputLayerId) {
						for (const piece of pieces) {
							if (piece.outputLayerId == outputLayerId._id) {
								switch (layerIdtoLayerType(piece.sourceLayerId)) {
									case SourceLayerType.SCRIPT:
										break

									case SourceLayerType.TRANSITION:
									case SourceLayerType.VT:
									case SourceLayerType.CAMERA:
									case SourceLayerType.REMOTE:
									case SourceLayerType.SPLITS:
									case SourceLayerType.LIVE_SPEAK:
										layerGroups[output].primary.push(piece)
										break

									case SourceLayerType.GRAPHICS:
									case SourceLayerType.LOWER_THIRD:
										layerGroups[output].overlays.push(piece)
										break

									case SourceLayerType.AUDIO:
									case SourceLayerType.MIC:
										layerGroups[output].audio.push(piece)
										break

									default:
										layerGroups[output].other.push(piece)
										break
								}
							}
						}
					}
				}
			}

			return layerGroups
		}

		render() {
			const sortedPieces = this.sortPieces()
			let partAttributes = this.props.part.instance.part
			return (
				<React.Fragment>
					<div className="script-view-part-container">
						<div className="script-view-part-container__scripts">{this.renderScripts()}</div>

						<div className="script-view-part-container__layergroups">
							<div className="container">
								<div className="flex-scroll">
									{Object.keys(this.props.activeLayerGroups).map((output) =>
										Object.keys(this.props.activeLayerGroups[output]).map(
											(layerGroup) =>
												this.props.activeLayerGroups[output][layerGroup] && (
													<div key={output + '__' + layerGroup} className="box">
														{sortedPieces[output][layerGroup].map((p: Piece) => (
															<div
																key={output + '__' + layerGroup + '__' + p._id}
																className={
																	'script-view-part-container__layergroup__piece ' +
																	this.getLayerClass(p) +
																	' ' +
																	layerGroup
																}>
																{p.name}
															</div>
														))}
													</div>
												)
										)
									)}
								</div>
							</div>
						</div>
					</div>
					<div className={'script-view-nextline'}>
						<div className="timecode">
							{partAttributes.expectedDuration
								? RundownUtils.formatTimeToShortTime(partAttributes.expectedDuration)
								: ''}
						</div>
						<div className="autotag">{partAttributes.autoNext ? 'AUTO' : ''}</div>
					</div>
				</React.Fragment>
			)
		}
	}
)
