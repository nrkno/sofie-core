import Tooltip from 'rc-tooltip'
import React, { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Rundown } from '../../../lib/collections/Rundowns'
import { getAllowStudio } from '../../lib/localStorage'
import { RundownUtils } from '../../lib/rundown'
import { iconDragHandle, iconRemove, iconResync } from './icons'
import { DisplayFormattedTime } from './DisplayFormattedTime'
import { PathIcon } from '../../lib/ui/icons/rundownList'
import { LoopingIcon } from '../../lib/ui/icons/looping'
import { RundownViewLayoutSelection } from './RundownViewLayoutSelection'
import { RundownLayoutBase } from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { TOOLTIP_DEFAULT_DELAY } from '../../lib/lib'
import { Meteor } from 'meteor/meteor'
import { RundownPlaylists } from '../../collections'

interface IRundownListItemViewProps {
	isActive: boolean
	classNames: string[]
	htmlElementId: string
	connectDragSource: (content: ReactElement) => ReactElement | null
	rundownViewUrl?: string
	rundown: Rundown
	rundownLayouts: Array<RundownLayoutBase>
	showStyleBaseURL?: string
	showStyleName: string | undefined
	confirmReSyncRundownHandler?: () => void
	confirmDeleteRundownHandler?: () => void
	isDragLayer: boolean
	connectDropTarget: (content: ReactElement) => ReactElement | null
	renderTooltips: boolean
	isOnlyRundownInPlaylist?: boolean
}

export default function RundownListItemView(props: IRundownListItemViewProps): JSX.Element | null {
	const {
		isActive,
		connectDragSource,
		connectDropTarget,
		htmlElementId,
		rundownViewUrl,
		showStyleBaseURL,
		showStyleName,
		rundown,
		rundownLayouts,
		confirmReSyncRundownHandler,
		confirmDeleteRundownHandler,
		isOnlyRundownInPlaylist,
	} = props
	const { t } = useTranslation()

	if (!rundown.playlistId) throw new Meteor.Error(500, 'Rundown is not a part of a rundown playlist!')
	const playlist = RundownPlaylists.findOne(rundown.playlistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundown.playlistId}" not found!`)

	const classNames = props.classNames.slice()
	classNames.push('rundown-list-item')
	if (props.isDragLayer) {
		classNames.push('dragging')
	}

	const rundownNameContent = rundownViewUrl ? (
		<Link to={rundownViewUrl}>
			{isOnlyRundownInPlaylist && playlist.loop && <LoopingIcon />}
			{props.rundown.name}
		</Link>
	) : (
		props.rundown.name
	)

	const expectedStart = PlaylistTiming.getExpectedStart(rundown.timing)
	const expectedDuration = PlaylistTiming.getExpectedDuration(rundown.timing)
	const expectedEnd = PlaylistTiming.getExpectedEnd(rundown.timing)

	return connectDropTarget(
		<li id={htmlElementId} className={classNames.join(' ')}>
			<span className="rundown-list-item__name">
				{getAllowStudio()
					? connectDragSource(
							<span className="draghandle">
								<Tooltip
									overlay={t('Drag to reorder or move out of playlist')}
									placement="top"
									mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
									overlayStyle={{ display: props.renderTooltips ? undefined : 'none' }}
								>
									<button className="rundown-list-item__action">{iconDragHandle()}</button>
								</Tooltip>
							</span>
					  )
					: null}
				<b className="rundown-name">{rundownNameContent}</b>
				{props.rundown.description ? (
					<Tooltip overlay={props.rundown.description} trigger={['hover']} placement="right">
						<span className="rundown-list-description__icon">
							<PathIcon />
						</span>
					</Tooltip>
				) : null}

				{isActive === true ? (
					<Tooltip
						overlay={t('This rundown is currently active')}
						mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
						placement="bottom"
					>
						<div className="origo-pulse small right mrs">
							<div className="pulse-marker">
								<div className="pulse-rays"></div>
								<div className="pulse-rays delay"></div>
							</div>
						</div>
					</Tooltip>
				) : null}
			</span>
			{/* <RundownListItemProblems warnings={warnings} errors={errors} /> */}
			<span className="rundown-list-item__text">
				{showStyleBaseURL ? <Link to={showStyleBaseURL}>{showStyleName}</Link> : showStyleName || ''}
			</span>
			<span className="rundown-list-item__text">
				{expectedStart ? (
					<DisplayFormattedTime displayTimestamp={expectedStart} t={t} />
				) : expectedEnd && expectedDuration ? (
					<DisplayFormattedTime displayTimestamp={expectedEnd - expectedDuration} t={t} />
				) : (
					<span className="dimmed">{t('Not set')}</span>
				)}
			</span>
			<span className="rundown-list-item__text">
				{expectedDuration ? (
					isOnlyRundownInPlaylist && playlist.loop ? (
						<Tooltip
							overlay={t('This rundown will loop indefinitely')}
							mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
							placement="top"
						>
							<span>
								{t('({{timecode}})', {
									timecode: RundownUtils.formatDiffToTimecode(expectedDuration, false, true, true, false, true),
								})}
								&nbsp;
								<LoopingIcon />
							</span>
						</Tooltip>
					) : (
						RundownUtils.formatDiffToTimecode(expectedDuration, false, true, true, false, true)
					)
				) : isOnlyRundownInPlaylist && playlist.loop ? (
					<Tooltip
						overlay={t('This rundown will loop indefinitely')}
						mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
						placement="top"
					>
						<span>
							<LoopingIcon />
						</span>
					</Tooltip>
				) : (
					<span className="dimmed">{t('Not set')}</span>
				)}
			</span>
			<span className="rundown-list-item__text">
				{expectedEnd ? (
					<DisplayFormattedTime displayTimestamp={expectedEnd} t={t} />
				) : expectedStart && expectedDuration ? (
					<DisplayFormattedTime displayTimestamp={expectedStart + expectedDuration} t={t} />
				) : (
					<span className="dimmed">{t('Not set')}</span>
				)}
			</span>
			<span className="rundown-list-item__text">
				<DisplayFormattedTime displayTimestamp={rundown.modified} t={t} />
			</span>
			{rundownLayouts.some(
				(l) =>
					(RundownLayoutsAPI.isLayoutForShelf(l) && l.exposeAsStandalone) ||
					(RundownLayoutsAPI.isLayoutForRundownView(l) && l.exposeAsSelectableLayout)
			) && (
				<span className="rundown-list-item__text">
					{isOnlyRundownInPlaylist && (
						<RundownViewLayoutSelection
							rundowns={[rundown]}
							rundownLayouts={rundownLayouts}
							playlistId={rundown.playlistId}
						/>
					)}
				</span>
			)}
			<span className="rundown-list-item__actions">
				{confirmReSyncRundownHandler ? (
					<Tooltip
						mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
						overlay={t('Re-sync rundown data with {{nrcsName}}', { nrcsName: rundown.externalNRCSName || 'NRCS' })}
						placement="top"
					>
						<button className="rundown-list-item__action" onClick={() => confirmReSyncRundownHandler()}>
							{iconResync()}
						</button>
					</Tooltip>
				) : (
					<span className="rundown-list-item__action"></span>
				)}
				{confirmDeleteRundownHandler ? (
					<Tooltip mouseEnterDelay={TOOLTIP_DEFAULT_DELAY} overlay={t('Delete')} placement="top">
						<button className="rundown-list-item__action" onClick={() => confirmDeleteRundownHandler()}>
							{iconRemove()}
						</button>
					</Tooltip>
				) : null}
			</span>
		</li>
	)
}
