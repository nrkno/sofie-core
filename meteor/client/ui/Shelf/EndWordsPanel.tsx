import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	DashboardLayoutEndsWords,
	RundownLayoutBase,
	RundownLayoutEndWords,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementStyle } from './DashboardPanel'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ScriptContent } from '@sofie-automation/blueprints-integration'
import { getUnfinishedPieceInstancesReactive } from '../../lib/rundownLayouts'
import { getScriptPreview } from '../../lib/ui/scriptPreview'
import { UIShowStyleBase } from '../../../lib/api/showStyles'
import { PieceInstances } from '../../collections'
import { ReadonlyDeep } from 'type-fest'

interface IEndsWordsPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutEndWords
	playlist: DBRundownPlaylist
	showStyleBase: UIShowStyleBase
}

interface IEndsWordsPanelTrackedProps {
	livePieceInstance?: PieceInstance
}

interface IState {}

class EndWordsPanelInner extends React.Component<
	Translated<IEndsWordsPanelProps & IEndsWordsPanelTrackedProps>,
	IState
> {
	render(): JSX.Element {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)

		const { t, livePieceInstance, panel } = this.props
		const content = livePieceInstance?.piece.content as Partial<ScriptContent> | undefined

		const { endOfScript } = getScriptPreview(content?.fullScript || '')

		return (
			<div
				className={ClassNames(
					'end-words-panel timing',
					isDashboardLayout ? (panel as DashboardLayoutEndsWords).customClasses : undefined
				)}
				style={isDashboardLayout ? dashboardElementStyle(this.props.panel as DashboardLayoutEndsWords) : {}}
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
		return { livePieceInstance: getPieceWithScript(props) }
	},
	(_data, props: IEndsWordsPanelProps, nextProps: IEndsWordsPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(EndWordsPanelInner)

function getPieceWithScript(props: IEndsWordsPanelProps): PieceInstance | undefined {
	const currentPartInstanceId = props.playlist.currentPartInfo?.partInstanceId

	const unfinishedPiecesIncludingFinishedPiecesWhereEndTimeHaveNotBeenSet = getUnfinishedPieceInstancesReactive(
		props.playlist,
		props.showStyleBase
	)

	const highestStartedPlayback = unfinishedPiecesIncludingFinishedPiecesWhereEndTimeHaveNotBeenSet.reduce(
		(hsp, piece: ReadonlyDeep<PieceInstance>) => Math.max(hsp, piece.reportedStartedPlayback ?? 0),
		0
	)

	const unfinishedPieces = unfinishedPiecesIncludingFinishedPiecesWhereEndTimeHaveNotBeenSet.filter(
		(pieceInstance: ReadonlyDeep<PieceInstance>) => {
			return !pieceInstance.reportedStartedPlayback || pieceInstance.reportedStartedPlayback == highestStartedPlayback
		}
	)

	const activeLayers = unfinishedPieces.map((p) => p.piece.sourceLayerId)
	const hasAdditionalLayer: boolean = props.panel.additionalLayers?.some((s) => activeLayers.includes(s)) ?? false

	if (!hasAdditionalLayer) {
		return undefined
	}

	// we have to call this because getUnfinishedPieceInstancesReactive does not return script/manus pieces
	const piecesInPart: PieceInstance[] = currentPartInstanceId
		? PieceInstances.find({
				partInstanceId: currentPartInstanceId,
				playlistActivationId: props.playlist.activationId,
		  }).fetch()
		: []

	return props.panel.requiredLayerIds && props.panel.requiredLayerIds.length
		? piecesInPart.find((piece: PieceInstance) => {
				return (
					(props.panel.requiredLayerIds || []).indexOf(piece.piece.sourceLayerId) !== -1 &&
					piece.partInstanceId === props.playlist.currentPartInfo?.partInstanceId
				)
		  })
		: undefined
}
