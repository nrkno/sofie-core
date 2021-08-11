import * as React from 'react'
import Sorensen from 'sorensen'
import { useTranslation } from 'react-i18next'
import { useSubscription, useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { PubSub } from '../../../../../lib/api/pubsub'
import { ShowStyleBaseId, ShowStyleBases } from '../../../../../lib/collections/ShowStyleBases'
import { TriggeredActionId, TriggeredActions } from '../../../../../lib/collections/TriggeredActions'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { TriggeredActionEntry } from './TriggeredActionEntry'
import { literal, unprotectString } from '../../../../../lib/lib'
import { useEffect, useState } from 'react'
import { TriggersHandler } from '../../../../lib/triggers/TriggersHandler'
import { RundownPlaylist, RundownPlaylists } from '../../../../../lib/collections/RundownPlaylists'
import { Rundown, Rundowns } from '../../../../../lib/collections/Rundowns'
import { PartInstances } from '../../../../../lib/collections/PartInstances'
import { Part, PartId, Parts } from '../../../../../lib/collections/Parts'

export const SorensenContext = React.createContext<null | typeof Sorensen>(null)

export interface PreviewContext {
	rundownPlaylist: RundownPlaylist | null
	currentSegmentPartIds: PartId[]
	nextSegmentPartIds: PartId[]
	currentPartId: PartId | null
	nextPartId: PartId | null
}

interface IProps {
	showStyleBaseId: ShowStyleBaseId
}

export const TriggeredActionsEditor: React.FC<IProps> = function TriggeredActionsEditor(
	props: IProps
): React.ReactElement | null {
	const [localSorensen, setLocalSorensen] = useState<null | typeof Sorensen>(null)
	const [selectedTriggeredActionId, setSelectedTriggeredActionId] = useState<null | TriggeredActionId>(null)

	const showStyleBase = useTracker(() => ShowStyleBases.findOne(props.showStyleBaseId), [props.showStyleBaseId])

	const { showStyleBaseId } = props
	const showStyleBaseSelector = {
		$or: [
			{
				showStyleBaseId: {
					$exists: false,
				},
			},
			{
				showStyleBaseId: showStyleBaseId,
			},
		],
	}

	useSubscription(PubSub.triggeredActions, showStyleBaseSelector)
	useSubscription(PubSub.rundowns, {
		showStyleBaseId,
	})

	const systemTriggeredActions = useTracker(
		() =>
			TriggeredActions.find({
				showStyleBaseId: {
					$exists: false,
				},
			}).fetch(),
		[]
	)
	const showTriggeredActions = useTracker(
		() =>
			TriggeredActions.find({
				showStyleBaseId: showStyleBaseId,
			}).fetch(),
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
		if (activePlaylists) {
			selectedRundown = Rundowns.findOne({
				playlistId: {
					$in: activePlaylists.map((playlist) => playlist._id),
				},
				showStyleBaseId,
			})
		}
		if (!selectedRundown) {
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
				rundownPlaylist: rundownPlaylist,
			})
		},
		[rundownPlaylist?.currentPartInstanceId, rundownPlaylist?.nextPartInstanceId],
		{
			currentPartId: null,
			nextPartId: null,
			currentSegmentPartIds: [],
			nextSegmentPartIds: [],
			rundownPlaylist: rundownPlaylist,
		}
	)

	const { t } = useTranslation()
	useEffect(() => {
		Sorensen.init()
			.then(() => {
				setLocalSorensen(Sorensen)
			})
			.catch(console.error)

		return () => {
			Sorensen.destroy().catch(console.error)
		}
	}, [])

	function onEditEntry(e, triggeredActionId: TriggeredActionId) {
		if (selectedTriggeredActionId === triggeredActionId) {
			setSelectedTriggeredActionId(null)
		} else {
			setSelectedTriggeredActionId(triggeredActionId)
		}
	}

	return showStyleBase !== undefined ? (
		<div>
			<SorensenContext.Provider value={localSorensen}>
				{localSorensen && previewContext.rundownPlaylist && (
					<TriggersHandler
						sorensen={localSorensen}
						simulateTriggerBinding={true}
						showStyleBaseId={showStyleBaseId}
						rundownPlaylistId={previewContext.rundownPlaylist._id}
						currentPartId={previewContext.currentPartId}
						nextPartId={previewContext.nextPartId}
						currentSegmentPartIds={previewContext.currentSegmentPartIds}
						nextSegmentPartIds={previewContext.nextSegmentPartIds}
					/>
				)}
				<h2 className="mhn">{t('Action Triggers')}</h2>
				<div className="mod mhn">
					{showTriggeredActions?.map((triggeredAction) => (
						<TriggeredActionEntry
							key={unprotectString(triggeredAction._id)}
							triggeredAction={triggeredAction}
							selected={selectedTriggeredActionId === triggeredAction._id}
							onEdit={(e) => onEditEntry(e, triggeredAction._id)}
							showStyleBase={showStyleBase}
							previewContext={rundownPlaylist ? previewContext : null}
							onFocus={() => setSelectedTriggeredActionId(triggeredAction._id)}
						/>
					))}
				</div>
				{(systemTriggeredActions?.length ?? 0) > 0 ? <hr /> : null}
				<div className="mod mhn">
					{(systemTriggeredActions?.length ?? 0) > 0 ? <h3 className="mhn">{t('System-wide')}</h3> : null}
					{systemTriggeredActions?.map((triggeredAction) => (
						<TriggeredActionEntry
							key={unprotectString(triggeredAction._id)}
							triggeredAction={triggeredAction}
							selected={selectedTriggeredActionId === triggeredAction._id}
							onEdit={(e) => onEditEntry(e, triggeredAction._id)}
							showStyleBase={showStyleBase}
							previewContext={rundownPlaylist ? previewContext : null}
							onFocus={() => setSelectedTriggeredActionId(triggeredAction._id)}
						/>
					))}
				</div>
				<div className="mod mhs">
					<button className="btn btn-primary" onClick={() => {}}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</SorensenContext.Provider>
		</div>
	) : null
}
