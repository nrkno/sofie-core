import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	DashboardLayoutEndsWords,
	RundownLayoutBase,
	RundownLayoutEndWords,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition } from './DashboardPanel'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PieceInstance, PieceInstances } from '../../../lib/collections/PieceInstances'
import { ScriptContent, Time } from '@sofie-automation/blueprints-integration'
import { GetScriptPreview } from '../scriptPreview'
import { DBShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { getUnfinishedPieceInstancesReactive } from '../../lib/rundownLayouts'

interface IEndsWordsPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutEndWords
	playlist: RundownPlaylist
	showStyleBase: DBShowStyleBase
}

interface IEndsWordsPanelTrackedProps {
	livePieceInstance?: PieceInstance
}

interface IState {}

export class EndWordsPanelInner extends MeteorReactComponent<
	Translated<IEndsWordsPanelProps & IEndsWordsPanelTrackedProps>,
	IState
> {
	constructor(props) {
		super(props)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)

		const { t, livePieceInstance, panel } = this.props
		const content = livePieceInstance?.piece.content as Partial<ScriptContent> | undefined

		const { endOfScript } = GetScriptPreview(content?.fullScript || '')

		return (
			<div
				className={ClassNames(
					'end-words-panel timing',
					isDashboardLayout ? (panel as DashboardLayoutEndsWords).customClasses : undefined
				)}
				style={_.extend(
					isDashboardLayout
						? {
								...dashboardElementPosition({ ...(this.props.panel as DashboardLayoutEndsWords) }),
								fontSize: ((panel as DashboardLayoutEndsWords).scale || 1) * 1.5 + 'em',
						  }
						: {}
				)}
			>
				<div className="timing-clock left">
					{!this.props.panel.hideLabel && <span className="timing-clock-label">{t('End Words')}</span>}
					<span className="text">&lrm;{endOfScript}&lrm;</span>
				</div>
			</div>
		)
	}
}

export const EndWordsPanel = translateWithTracker<IEndsWordsPanelProps, IState, IEndsWordsPanelTrackedProps>(
	(props: IEndsWordsPanelProps) => {
		return { livePieceInstance: getPieceWithManus(props) }
	},
	(_data, props: IEndsWordsPanelProps, nextProps: IEndsWordsPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(EndWordsPanelInner)

function getPieceWithManus(props: IEndsWordsPanelProps): PieceInstance | undefined {
	const currentPartInstanceId: any = props.playlist.currentPartInstanceId

	const unfinishedPiecesIncludingFinishedPiecesWhereEndTimeHaveNotBeenSet = getUnfinishedPieceInstancesReactive(
		props.playlist,
		props.showStyleBase
	)

	const highestStartedPlayback = unfinishedPiecesIncludingFinishedPiecesWhereEndTimeHaveNotBeenSet.reduce(
		(hsp, piece: PieceInstance) => Math.max(hsp, piece.startedPlayback ?? 0), 0
	)

	const unfinishedPieces = unfinishedPiecesIncludingFinishedPiecesWhereEndTimeHaveNotBeenSet.filter(
		(pieceInstance: PieceInstance) => {
			return !pieceInstance.startedPlayback || pieceInstance.startedPlayback == highestStartedPlayback
		}
	)

	const activeLayers = unfinishedPieces.map((p) => p.piece.sourceLayerId)
	const hasAdditionalLayer: boolean = props.panel.additionalLayers?.some((s) => activeLayers.includes(s)) ?? false

	if (!hasAdditionalLayer) {
		return undefined
	}

	// we have to call this because getUnfinishedPieceInstancesReactive does not return script/manus pieces
	const piecesInPart: PieceInstance[] = PieceInstances.find({
		partInstanceId: currentPartInstanceId,
		playlistActivationId: props.playlist.activationId,
	}).fetch()

	return props.panel.requiredLayerIds && props.panel.requiredLayerIds.length
		? _.flatten(Object.values(piecesInPart)).find((piece: PieceInstance) => {
				return (
					(props.panel.requiredLayerIds || []).indexOf(piece.piece.sourceLayerId) !== -1 &&
					piece.partInstanceId === props.playlist.currentPartInstanceId
				)
		  })
		: undefined
}
