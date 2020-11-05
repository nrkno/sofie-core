import Tooltip from 'rc-tooltip'
import React, { ReactElement } from 'react'
import { withTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { Link } from 'react-router-dom'
import { Rundown } from '../../../lib/collections/Rundowns'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { MomentFromNow } from '../../lib/Moment'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { RundownUtils } from '../../lib/rundown'
import { iconDragHandle, iconRemove, iconResync } from './icons'

interface IRundownListItemViewProps {
	classNames: string[]
	htmlElementId: string
	connectDragSource: (content: ReactElement) => ReactElement | null
	playlistViewUrl: string
	rundown: Rundown
	showStyleBaseURL: string
	showStyle: ShowStyleBase
	confirmReSyncRundownHandler?: () => void
	confirmDeleteRundownHandler?: () => void
	isDragLayer: boolean
	connectDropTarget: (content: ReactElement) => ReactElement | null
}

export default withTranslation()(function RundownListItemView(props: Translated<IRundownListItemViewProps>) {
	const {
		t,
		connectDragSource,
		connectDropTarget,
		htmlElementId,
		playlistViewUrl,
		showStyleBaseURL,
		showStyle,
		rundown,
		confirmReSyncRundownHandler,
		confirmDeleteRundownHandler,
	} = props

	const classNames = props.classNames.slice()
	classNames.push('rundown-list-item')
	if (props.isDragLayer) {
		classNames.push('dragging')
	}

	return connectDropTarget(
		<li id={htmlElementId} className={classNames.join(' ')}>
			<span className="rundown-list-item__name rundown-list-item__text">
				{connectDragSource(
					<span className="draghandle">
						<Tooltip overlay={t('Drag to reorder or move out of playlist')} placement="top">
							<button className="rundown-list-item__action">{iconDragHandle()}</button>
						</Tooltip>
					</span>
				)}
				<b>
					<Link to={playlistViewUrl}>{props.rundown.name}</Link>
				</b>
			</span>
			<span className="rundown-list-item__problems rundown-list-item__text">{rundown.status}</span>
			<span className="rundown-list-item__showStyle rundown-list-item__text">
				{showStyleBaseURL ? <Link to={showStyleBaseURL}>{showStyle.name}</Link> : showStyle.name}
			</span>
			<span className="rundown-list-item__airTime rundown-list-item__text">
				{rundown.expectedStart && (
					<>
						<MomentFromNow>{rundown.expectedStart}</MomentFromNow>{' '}
						<Moment format="HH:mm:ss">{rundown.expectedStart}</Moment>
					</>
				)}
			</span>
			<span className="rundown-list-item__duration rundown-list-item__text">
				{rundown.expectedDuration &&
					RundownUtils.formatDiffToTimecode(rundown.expectedDuration, false, true, true, false, true)}
			</span>
			<span className="rundown-list-item__created rundown-list-item__text">
				<MomentFromNow>{rundown.created}</MomentFromNow>
			</span>
			<span className="rundown-list-item__actions">
				{confirmReSyncRundownHandler ? (
					<Tooltip overlay={t('Re-sync all rundowns in playlist')} placement="top">
						<button className="rundown-list-item__action" onClick={() => confirmReSyncRundownHandler()}>
							{iconResync()}
						</button>
					</Tooltip>
				) : (
					<span className="rundown-list-item__action"></span>
				)}
				{confirmDeleteRundownHandler ? (
					<Tooltip overlay={t('Delete')} placement="top">
						<button className="rundown-list-item__action" onClick={() => confirmDeleteRundownHandler()}>
							{iconRemove()}
						</button>
					</Tooltip>
				) : null}
			</span>
		</li>
	)
})
