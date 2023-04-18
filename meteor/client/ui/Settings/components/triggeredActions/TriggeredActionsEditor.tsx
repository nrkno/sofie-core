import React, { useState, useEffect, useContext, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSubscription, useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { PubSub } from '../../../../../lib/api/pubsub'
import { TriggeredActionsObj } from '../../../../../lib/collections/TriggeredActions'
import { faCaretDown, faCaretRight, faDownload, faPlus, faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { TriggeredActionEntry, TRIGGERED_ACTION_ENTRY_DRAG_TYPE } from './TriggeredActionEntry'
import { literal, unprotectString } from '../../../../../lib/lib'
import { TriggersHandler } from '../../../../lib/triggers/TriggersHandler'
import { RundownPlaylist } from '../../../../../lib/collections/RundownPlaylists'
import { Rundown } from '../../../../../lib/collections/Rundowns'
import { Part } from '../../../../../lib/collections/Parts'
import { MeteorCall } from '../../../../../lib/api/methods'
import { UploadButton } from '../../../../lib/uploadButton'
import { ErrorBoundary } from '../../../../lib/ErrorBoundary'
import { SorensenContext } from '../../../../lib/SorensenContext'
import Tooltip from 'rc-tooltip'
import { useDrop } from 'react-dnd'
import { TriggerType } from '@sofie-automation/blueprints-integration'
import { keyLabelsToCodes } from '../../../../lib/triggers/codesToKeyLabels'
import classNames from 'classnames'
import { fetchFrom } from '../../../../lib/lib'
import { NotificationCenter, Notification, NoticeLevel } from '../../../../../lib/notifications/notifications'
import { Meteor } from 'meteor/meteor'
import { doModalDialog } from '../../../../lib/ModalDialog'
import { MongoQuery } from '../../../../../lib/typings/meteor'
import _ from 'underscore'
import { PartId, RundownId, ShowStyleBaseId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PartInstances, Parts, RundownPlaylists, Rundowns, TriggeredActions } from '../../../../collections'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { SourceLayers, OutputLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { RundownPlaylistCollectionUtil } from '../../../../../lib/collections/rundownPlaylistUtil'

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
	sourceLayers: SourceLayers
	outputLayers: OutputLayers
}

export const TriggeredActionsEditor: React.FC<IProps> = function TriggeredActionsEditor(
	props: IProps
): React.ReactElement | null {
	const sorensen = useContext(SorensenContext)
	const [uploadFileKey, setUploadFileKey] = useState(Date.now())
	const [systemWideCollapsed, setSystemWideCollapsed] = useState(true)
	const [selectedTriggeredActionId, setSelectedTriggeredActionId] = useState<null | TriggeredActionId>(null)
	const [triggerFilter, setTriggerFilter] = useState('')
	const [parsedTriggerFilter, setParsedTriggerFilter] = useState(triggerFilter)

	const [{ isOver: _isOver }, drop] = useDrop({
		// The type (or types) to accept - strings or symbols
		accept: TRIGGERED_ACTION_ENTRY_DRAG_TYPE,
		// Props to collect
		collect: (monitor) => ({
			isOver: monitor.isOver(),
			canDrop: monitor.canDrop(),
		}),
		canDrop: () => {
			return systemWideCollapsed
		},
		drop: () => undefined,
		hover: (_, monitor) => {
			if (monitor.canDrop() && systemWideCollapsed) {
				setSystemWideCollapsed(false)
			}
		},
	})

	const { showStyleBaseId, sourceLayers, outputLayers } = props
	const showStyleBaseSelector: MongoQuery<TriggeredActionsObj> = {
		$or: _.compact([
			{
				showStyleBaseId: null,
			},
			showStyleBaseId !== null
				? {
						showStyleBaseId: showStyleBaseId,
				  }
				: undefined,
		]),
	}

	useSubscription(PubSub.triggeredActions, showStyleBaseSelector)
	useSubscription(PubSub.rundowns, null, showStyleBaseId ? [showStyleBaseId] : [])

	useEffect(() => {
		const debounce = setTimeout(() => {
			if (sorensen) {
				setParsedTriggerFilter(keyLabelsToCodes(triggerFilter, sorensen).replace(/\+/, '\\+'))
			} else {
				setParsedTriggerFilter(triggerFilter.replace(/\+/, '\\+'))
			}
		}, 150)

		return () => {
			clearTimeout(debounce)
		}
	}, [triggerFilter])

	const systemTriggeredActionIds = useTracker(
		() =>
			TriggeredActions.find(
				Object.assign(
					{
						showStyleBaseId: null,
					},
					parsedTriggerFilter
						? {
								triggers: {
									$elemMatch: {
										type: TriggerType.hotkey,
										keys: { $regex: `${parsedTriggerFilter}`, $options: 'i' },
									},
								},
						  }
						: undefined
				),
				{
					sort: {
						_rank: 1,
					},
					fields: {
						_id: 1,
					},
				}
			).map((triggeredAction) => triggeredAction._id),
		[parsedTriggerFilter]
	)
	const showTriggeredActionIds = useTracker(
		() =>
			TriggeredActions.find(
				Object.assign(
					{
						showStyleBaseId: showStyleBaseId,
					},
					parsedTriggerFilter
						? {
								triggers: {
									$elemMatch: {
										type: TriggerType.hotkey,
										keys: { $regex: `${parsedTriggerFilter}`, $options: 'i' },
									},
								},
						  }
						: undefined
				),
				{
					sort: {
						_rank: 1,
					},
					fields: {
						_id: 1,
					},
				}
			).map((triggeredAction) => triggeredAction._id),
		[showStyleBaseId, parsedTriggerFilter]
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

	useSubscription(PubSub.partInstances, rundown ? [rundown._id] : [], rundownPlaylist?.activationId)
	useSubscription(PubSub.parts, rundown ? [rundown._id] : [])

	const previewContext = useTracker(
		() => {
			let thisCurrentPart: Part | null = null
			let thisNextPart: Part | null = null
			let thisCurrentSegmentPartIds: PartId[] = []
			let thisNextSegmentPartIds: PartId[] = []
			if (rundownPlaylist) {
				if (rundownPlaylist.currentPartInfo) {
					const currentPartInstance = PartInstances.findOne(rundownPlaylist.currentPartInfo.partInstanceId)
					if (currentPartInstance) {
						thisCurrentPart = currentPartInstance.part
						thisCurrentSegmentPartIds = Parts.find({
							segmentId: currentPartInstance.segmentId,
						}).map((part) => part._id)
					}
				}
				if (rundownPlaylist.nextPartInfo) {
					const nextPartInstance = PartInstances.findOne(rundownPlaylist.nextPartInfo.partInstanceId)
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
					(rundownPlaylist ? RundownPlaylistCollectionUtil.getRundownOrderedIDs(rundownPlaylist)[0] : null) ??
					null,
				rundownPlaylist: rundownPlaylist,
			})
		},
		[rundownPlaylist?.currentPartInfo?.partInstanceId, rundownPlaylist?.nextPartInfo?.partInstanceId],
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

	const onEditEntry = useCallback(
		(triggeredActionId: TriggeredActionId) => {
			if (selectedTriggeredActionId === triggeredActionId) {
				setSelectedTriggeredActionId(null)
			} else {
				setSelectedTriggeredActionId(triggeredActionId)
			}
		},
		[selectedTriggeredActionId]
	)

	const onNewTriggeredAction = useCallback(() => {
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
	}, [props.showStyleBaseId])

	const onRemoveTriggeredAction = useCallback((triggeredActionId: TriggeredActionId) => {
		MeteorCall.triggeredActions.removeTriggeredActions(triggeredActionId).catch(console.error)
	}, [])

	const onDuplicateEntry = useCallback(
		(triggeredActionId: TriggeredActionId) => {
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
					.createTriggeredActions(triggeredAction.showStyleBaseId, {
						_rank: (triggeredAction._rank + nextTriggeredActionRank) / 2,
						name: triggeredAction.name,
						triggers: {},
						actions: applyAndValidateOverrides(triggeredAction.actionsWithOverrides).obj,
					})
					.then((duplicateTriggeredActionId) => setSelectedTriggeredActionId(duplicateTriggeredActionId))
					.catch(console.error)
			}
		},
		[setSelectedTriggeredActionId]
	)

	const onDownloadActions = useCallback(() => {
		window.location.replace(`/actionTriggers/download/${showStyleBaseId ?? ''}`)
	}, [showStyleBaseId])

	const onUploadActions = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files && e.target.files[0]
		if (!file) {
			return
		}

		const reader = new FileReader()
		reader.onload = (e2) => {
			// On file upload

			setUploadFileKey(Date.now())

			const uploadFileContents = (e2.target as any).result

			if (uploadFileContents) {
				function uploadStoredTriggeredActions(replace?: boolean) {
					fetchFrom(`/actionTriggers/upload/${showStyleBaseId ?? ''}${replace ? '?replace' : ''}`, {
						method: 'POST',
						body: uploadFileContents,
						headers: {
							'content-type': 'text/javascript',
							authorization: 'id ' + Meteor.userId(),
						},
					})
						.then(() => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.NOTIFICATION,
									t('Triggered Actions uploaded successfully.'),
									'TriggeredActions'
								)
							)
						})
						.catch((err) => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.WARNING,
									t('Triggered Actions failed to upload: {{errorMessage}}', { errorMessage: err + '' }),
									'TriggeredActions'
								)
							)
						})
				}

				doModalDialog({
					title: t('Append or Replace'),
					message: t('Do you want to append these to existing Action Triggers, or do you want to replace them?'),
					no: t('Append'),
					yes: t('Replace'),
					warning: true,
					onAccept: () => {
						uploadStoredTriggeredActions(true)
					},
					onSecondary: () => {
						uploadStoredTriggeredActions(false)
					},
				})
			}
		}
		reader.readAsText(file)
	}, [])

	return (
		<div>
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
			<div className="mod mhn mvn">
				<input
					className="form-control input text-input input-m"
					placeholder={t('Find Trigger...')}
					value={triggerFilter}
					onChange={(e) => setTriggerFilter(e.target.value)}
				/>
			</div>
			{showTriggeredActionIds?.length === 0 && systemTriggeredActionIds?.length === 0 ? (
				parsedTriggerFilter ? (
					<p className="mod mhn subtle">{t('No matching Action Trigger.')}</p>
				) : (
					<p className="mod mhn subtle">{t('No Action Triggers set up.')}</p>
				)
			) : null}
			<div className={classNames('mod mhn', parsedTriggerFilter ? 'mbn' : undefined)}>
				{showTriggeredActionIds?.map((triggeredActionId) => (
					<TriggeredActionEntry
						key={unprotectString(triggeredActionId)}
						triggeredActionId={triggeredActionId}
						selected={selectedTriggeredActionId === triggeredActionId}
						locked={!!parsedTriggerFilter}
						onEdit={onEditEntry}
						onRemove={onRemoveTriggeredAction}
						onDuplicate={onDuplicateEntry}
						sourceLayers={sourceLayers}
						outputLayers={outputLayers}
						previewContext={rundownPlaylist && selectedTriggeredActionId === triggeredActionId ? previewContext : null}
						onFocus={setSelectedTriggeredActionId}
					/>
				))}
			</div>
			{showStyleBaseId !== null ? (
				<>
					<div className={classNames('mod mhn', parsedTriggerFilter ? 'mtn' : undefined)}>
						{(systemTriggeredActionIds?.length ?? 0) > 0 && !parsedTriggerFilter ? (
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
						{!systemWideCollapsed || parsedTriggerFilter
							? systemTriggeredActionIds?.map((triggeredActionId) => (
									<TriggeredActionEntry
										key={unprotectString(triggeredActionId)}
										triggeredActionId={triggeredActionId}
										selected={selectedTriggeredActionId === triggeredActionId}
										locked={!!parsedTriggerFilter}
										onEdit={onEditEntry}
										onRemove={onRemoveTriggeredAction}
										onDuplicate={onDuplicateEntry}
										sourceLayers={sourceLayers}
										outputLayers={outputLayers}
										previewContext={
											rundownPlaylist && selectedTriggeredActionId === triggeredActionId ? previewContext : null
										}
										onFocus={setSelectedTriggeredActionId}
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
							key={uploadFileKey}
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
		</div>
	)
}
