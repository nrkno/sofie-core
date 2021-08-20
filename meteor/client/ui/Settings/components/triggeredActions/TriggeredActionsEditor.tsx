import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSubscription, useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { PubSub } from '../../../../../lib/api/pubsub'
import { ShowStyleBaseId, ShowStyleBases } from '../../../../../lib/collections/ShowStyleBases'
import { TriggeredActionId, TriggeredActions } from '../../../../../lib/collections/TriggeredActions'
import { faCaretDown, faCaretRight, faDownload, faPlus, faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { TriggeredActionEntry, TRIGGERED_ACTION_ENTRY_DRAG_TYPE } from './TriggeredActionEntry'
import { literal, omit, unprotectString } from '../../../../../lib/lib'
import { TriggersHandler } from '../../../../lib/triggers/TriggersHandler'
import { RundownPlaylist, RundownPlaylists } from '../../../../../lib/collections/RundownPlaylists'
import { Rundown, RundownId, Rundowns } from '../../../../../lib/collections/Rundowns'
import { PartInstances } from '../../../../../lib/collections/PartInstances'
import { Part, PartId, Parts } from '../../../../../lib/collections/Parts'
import { MeteorCall } from '../../../../../lib/api/methods'
import { UploadButton } from '../../../../lib/uploadButton'
import { ErrorBoundary } from '../../../../lib/ErrorBoundary'
import { SorensenContext } from '../../../../lib/SorensenContext'
import Tooltip from 'rc-tooltip'
import { useDrop } from 'react-dnd'

export interface PreviewContext {
	rundownPlaylist: RundownPlaylist | null
	currentRundownId: RundownId | null
	currentSegmentPartIds: PartId[]
	nextSegmentPartIds: PartId[]
	currentPartId: PartId | null
	nextPartId: PartId | null
}

interface IProps {
	showStyleBaseId: ShowStyleBaseId | null
}

export const TriggeredActionsEditor: React.FC<IProps> = function TriggeredActionsEditor(
	props: IProps
): React.ReactElement | null {
	const [systemWideCollapsed, setSystemWideCollapsed] = useState(true)
	const [selectedTriggeredActionId, setSelectedTriggeredActionId] = useState<null | TriggeredActionId>(null)

	const [{ isOver: _isOver }, drop] = useDrop({
		// The type (or types) to accept - strings or symbols
		accept: TRIGGERED_ACTION_ENTRY_DRAG_TYPE,
		// Props to collect
		collect: (monitor) => ({
			isOver: monitor.isOver(),
			canDrop: monitor.canDrop(),
		}),
		canDrop: (item) => (item.type === TRIGGERED_ACTION_ENTRY_DRAG_TYPE ? systemWideCollapsed : false),
		drop: () => undefined,
		hover: (_, monitor) => {
			if (monitor.canDrop() && systemWideCollapsed) {
				setSystemWideCollapsed(false)
			}
		},
	})

	const showStyleBase = useTracker(
		() => (props.showStyleBaseId === null ? undefined : ShowStyleBases.findOne(props.showStyleBaseId)),
		[props.showStyleBaseId]
	)

	const { showStyleBaseId } = props
	const showStyleBaseSelector = {
		$or: [
			{
				showStyleBaseId: null,
			},
			showStyleBaseId !== null
				? {
						showStyleBaseId: showStyleBaseId,
				  }
				: undefined,
		].filter(Boolean),
	}

	useSubscription(PubSub.triggeredActions, showStyleBaseSelector)
	useSubscription(PubSub.rundowns, {
		showStyleBaseId,
	})

	const systemTriggeredActions = useTracker(
		() =>
			TriggeredActions.find(
				{
					showStyleBaseId: null,
				},
				{
					sort: {
						_rank: 1,
					},
				}
			).fetch(),
		[]
	)
	const showTriggeredActions = useTracker(
		() =>
			TriggeredActions.find(
				{
					showStyleBaseId: showStyleBaseId,
				},
				{
					sort: {
						_rank: 1,
					},
				}
			).fetch(),
		[showStyleBaseId]
	)

	useSubscription(PubSub.rundownPlaylists, {})

	const rundown = useTracker(() => {
		const activePlaylists = RundownPlaylists.find(
			{
				activationId: {
					$exists: true,
				},
			},
			{
				fields: {
					_id: 1,
					activationId: 1,
				},
			}
		).fetch()
		let selectedRundown: Rundown | undefined = undefined
		if (showStyleBaseId && activePlaylists) {
			selectedRundown = Rundowns.findOne({
				playlistId: {
					$in: activePlaylists.map((playlist) => playlist._id),
				},
				showStyleBaseId,
			})
		}
		if (!selectedRundown && showStyleBaseId) {
			selectedRundown = Rundowns.findOne({
				showStyleBaseId,
			})
		}
		return selectedRundown
	}, [showStyleBaseId])

	const rundownPlaylist = useTracker(
		() => RundownPlaylists.findOne(rundown?.playlistId) ?? null,
		[rundown?.playlistId],
		null
	)

	useSubscription(PubSub.partInstances, {
		rundownId: rundown?._id ?? false,
		playlistActivationId: rundownPlaylist?.activationId,
	})
	useSubscription(PubSub.parts, {
		rundownId: rundown?._id ?? false,
	})

	const previewContext = useTracker(
		() => {
			let thisCurrentPart: Part | null = null
			let thisNextPart: Part | null = null
			let thisCurrentSegmentPartIds: PartId[] = []
			let thisNextSegmentPartIds: PartId[] = []
			if (rundownPlaylist) {
				if (rundownPlaylist.currentPartInstanceId) {
					const currentPartInstance = PartInstances.findOne(rundownPlaylist.currentPartInstanceId)
					if (currentPartInstance) {
						thisCurrentPart = currentPartInstance.part
						thisCurrentSegmentPartIds = Parts.find({
							segmentId: currentPartInstance.segmentId,
						}).map((part) => part._id)
					}
				}
				if (rundownPlaylist.nextPartInstanceId) {
					const nextPartInstance = PartInstances.findOne(rundownPlaylist.nextPartInstanceId)
					if (nextPartInstance) {
						thisNextPart = nextPartInstance.part
						thisNextSegmentPartIds = Parts.find({
							segmentId: nextPartInstance.segmentId,
						}).map((part) => part._id)
					}
				}
			}
			return literal<PreviewContext>({
				currentPartId: thisCurrentPart?._id ?? null,
				nextPartId: thisNextPart?._id ?? null,
				currentSegmentPartIds: thisCurrentSegmentPartIds,
				nextSegmentPartIds: thisNextSegmentPartIds,
				currentRundownId:
					thisCurrentPart?.rundownId ??
					thisNextPart?.rundownId ??
					Rundowns.findOne(
						{
							playlistId: rundownPlaylist?._id,
						},
						{
							fields: {
								_id: 1,
							},
							sort: {
								_rank: 1,
							},
						}
					)?._id ??
					null,
				rundownPlaylist: rundownPlaylist,
			})
		},
		[rundownPlaylist?.currentPartInstanceId, rundownPlaylist?.nextPartInstanceId],
		{
			currentPartId: null,
			nextPartId: null,
			currentSegmentPartIds: [],
			nextSegmentPartIds: [],
			currentRundownId: null,
			rundownPlaylist: rundownPlaylist,
		}
	)

	const { t } = useTranslation()

	function onEditEntry(triggeredActionId: TriggeredActionId) {
		if (selectedTriggeredActionId === triggeredActionId) {
			setSelectedTriggeredActionId(null)
		} else {
			setSelectedTriggeredActionId(triggeredActionId)
		}
	}

	function onNewTriggeredAction() {
		MeteorCall.triggeredActions
			.createTriggeredActions(props.showStyleBaseId ?? null, {
				_rank:
					(TriggeredActions.findOne(
						{
							showStyleBaseId: props.showStyleBaseId ?? null,
						},
						{
							sort: {
								_rank: -1,
							},
						}
					)?._rank ?? 0) + 1000,
			})
			.catch(console.error)
	}

	function onRemoveTriggeredAction(triggeredActionsId: TriggeredActionId) {
		MeteorCall.triggeredActions.removeTriggeredActions(triggeredActionsId).catch(console.error)
	}

	function onDuplicateEntry(triggeredActionId: TriggeredActionId) {
		const triggeredAction = TriggeredActions.findOne(triggeredActionId)
		if (triggeredAction) {
			const nextTriggeredActionRank =
				TriggeredActions.find(
					{
						showStyleBaseId: triggeredAction.showStyleBaseId,
						_rank: {
							$gt: triggeredAction._rank,
						},
					},
					{
						sort: {
							_rank: 1,
						},
						limit: 1,
					}
				).fetch()[0]?._rank ?? triggeredAction._rank + 1000
			MeteorCall.triggeredActions
				.createTriggeredActions(
					triggeredAction.showStyleBaseId,
					omit(
						{ ...triggeredAction, triggers: [], _rank: (triggeredAction._rank + nextTriggeredActionRank) / 2 },
						'_id',
						'_rundownVersionHash',
						'showStyleBaseId'
					)
				)
				.then((duplicateTriggeredActionId) => setSelectedTriggeredActionId(duplicateTriggeredActionId))
				.catch(console.error)
		}
	}

	function onDownloadActions() {
		window.location.replace(`/actionTriggers/download/${showStyleBaseId ?? ''}`)
	}

	function onUploadActions() {}

	return (
		<div>
			<SorensenContext.Consumer>
				{(sorensen) => (
					<>
						{sorensen && previewContext.rundownPlaylist && showStyleBaseId && (
							<ErrorBoundary>
								<TriggersHandler
									sorensen={sorensen}
									simulateTriggerBinding={true}
									showStyleBaseId={showStyleBaseId}
									currentRundownId={previewContext.currentRundownId}
									rundownPlaylistId={previewContext.rundownPlaylist._id}
									currentPartId={previewContext.currentPartId}
									nextPartId={previewContext.nextPartId}
									currentSegmentPartIds={previewContext.currentSegmentPartIds}
									nextSegmentPartIds={previewContext.nextSegmentPartIds}
								/>
							</ErrorBoundary>
						)}
						<h2 className="mhn">{t('Action Triggers')}</h2>
						<div className="mod mhn">
							{showTriggeredActions?.map((triggeredAction) => (
								<TriggeredActionEntry
									key={unprotectString(triggeredAction._id)}
									triggeredAction={triggeredAction}
									selected={selectedTriggeredActionId === triggeredAction._id}
									onEdit={() => onEditEntry(triggeredAction._id)}
									onRemove={() => onRemoveTriggeredAction(triggeredAction._id)}
									onDuplicate={() => onDuplicateEntry(triggeredAction._id)}
									showStyleBase={showStyleBase}
									previewContext={rundownPlaylist ? previewContext : null}
									onFocus={() => setSelectedTriggeredActionId(triggeredAction._id)}
								/>
							))}
						</div>
						{showStyleBaseId !== null ? (
							<>
								<div className="mod mhn">
									{(systemTriggeredActions?.length ?? 0) > 0 ? (
										<h3
											className="mhn mvs clickable disable-select"
											onClick={() => setSystemWideCollapsed(!systemWideCollapsed)}
											role="button"
											tabIndex={0}
											ref={drop}
										>
											<span className="icon action-item">
												<FontAwesomeIcon icon={systemWideCollapsed ? faCaretRight : faCaretDown} />
											</span>
											{t('System-wide')}
										</h3>
									) : null}
									{!systemWideCollapsed
										? systemTriggeredActions?.map((triggeredAction) => (
												<TriggeredActionEntry
													key={unprotectString(triggeredAction._id)}
													triggeredAction={triggeredAction}
													selected={selectedTriggeredActionId === triggeredAction._id}
													onEdit={() => onEditEntry(triggeredAction._id)}
													onRemove={() => onRemoveTriggeredAction(triggeredAction._id)}
													onDuplicate={() => onDuplicateEntry(triggeredAction._id)}
													showStyleBase={showStyleBase}
													previewContext={rundownPlaylist ? previewContext : null}
													onFocus={() => setSelectedTriggeredActionId(triggeredAction._id)}
												/>
										  ))
										: null}
								</div>
							</>
						) : null}
						<div className="mod mhs">
							<button className="btn btn-primary" onClick={onNewTriggeredAction}>
								<FontAwesomeIcon icon={faPlus} />
							</button>
							<Tooltip overlay={t('Upload stored Action Triggers')} placement="top">
								<span className="inline-block">
									<UploadButton
										className="btn btn-secondary mls"
										onChange={onUploadActions}
										accept="application/json,.json"
									>
										<FontAwesomeIcon icon={faUpload} />
									</UploadButton>
								</span>
							</Tooltip>
							<Tooltip overlay={t('Download Action Triggers')} placement="top">
								<button className="btn btn-secondary mls" onClick={onDownloadActions}>
									<FontAwesomeIcon icon={faDownload} />
								</button>
							</Tooltip>
						</div>
					</>
				)}
			</SorensenContext.Consumer>
		</div>
	)
}
