import React, { useState, useEffect, useCallback } from 'react'
import { faCopy, faPencilAlt, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PlayoutActions, SourceLayerType, TriggerType } from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'
import {
	DBBlueprintTrigger,
	TriggeredActionId,
	TriggeredActions,
} from '../../../../../lib/collections/TriggeredActions'
import { useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { ActionEditor } from './actionEditors/ActionEditor'
import { ShowStyleBase, ShowStyleBaseId } from '../../../../../lib/collections/ShowStyleBases'
import { flatten, normalizeArray } from '../../../../../lib/lib'
import { createAction, isPreviewableAction } from '../../../../../lib/api/triggers/actionFactory'
import { PreviewContext } from './TriggeredActionsEditor'
import { IWrappedAdLib } from '../../../../../lib/api/triggers/actionFilterChainCompilers'
import { RundownUtils } from '../../../../lib/rundown'
import { useTranslation } from 'react-i18next'
import { TriggerEditor } from './triggerEditors/TriggerEditor'
import { EditAttribute } from '../../../../lib/EditAttribute'
import { iconDragHandle } from '../../../RundownList/icons'
import { useDrag, useDrop } from 'react-dnd'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'

interface IProps {
	showStyleBase: ShowStyleBase | undefined
	triggeredActionId: TriggeredActionId
	selected?: boolean
	previewContext: PreviewContext | null
	locked?: boolean
	onEdit: (id: TriggeredActionId, e: React.UIEvent) => void
	onRemove: (id: TriggeredActionId, e: React.UIEvent) => void
	onDuplicate: (id: TriggeredActionId, e: React.UIEvent) => void
	onFocus?: (id: TriggeredActionId) => void
}

let LAST_UP_SETTING = false

export const TRIGGERED_ACTION_ENTRY_DRAG_TYPE = 'TriggeredActionEntry'

export const TriggeredActionEntry: React.FC<IProps> = React.memo(function TriggeredActionEntry(
	props: IProps
): React.ReactElement | null {
	const { showStyleBase, triggeredActionId, selected, locked, previewContext, onEdit, onRemove, onDuplicate } = props

	const triggeredAction = useTracker(() => TriggeredActions.findOne(triggeredActionId), [triggeredActionId])

	const { t } = useTranslation()
	const [selectedTrigger, setSelectedTrigger] = useState(-1)
	const [selectedAction, setSelectedAction] = useState(-1)

	const [{ isDragging }, drag, dragPreview] = useDrag({
		item: { id: triggeredActionId, type: TRIGGERED_ACTION_ENTRY_DRAG_TYPE },
		// The collect function utilizes a "monitor" instance (see the Overview for what this is)
		// to pull important pieces of state from the DnD system.
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
		end: (_, monitor) => {
			if (monitor.didDrop()) {
				const dropResult = monitor.getDropResult() as
					| {
							overId: TriggeredActionId
							overRank?: number
							overShowStyleBaseId?: ShowStyleBaseId
					  }
					| undefined
				if (dropResult && dropResult.overRank !== undefined && dropResult.overShowStyleBaseId) {
					let pairRank =
						TriggeredActions.findOne(
							{
								_rank: {
									$lt: dropResult.overRank,
								},
							},
							{
								sort: {
									_rank: -1,
								},
							}
						)?._rank ?? -1000
					if (pairRank === triggeredAction?._rank) {
						pairRank =
							TriggeredActions.findOne(
								{
									_rank: {
										$gt: dropResult.overRank,
									},
								},
								{
									sort: {
										_rank: 1,
									},
								}
							)?._rank ?? dropResult.overRank + 1000
					}
					const newRank = (pairRank + dropResult.overRank) / 2
					TriggeredActions.update(triggeredActionId, {
						$set: {
							_rank: newRank,
							showStyleBaseId: dropResult.overShowStyleBaseId,
						},
					})
				}
			}
		},
	})

	const [{ isOver }, drop] = useDrop({
		// The type (or types) to accept - strings or symbols
		accept: TRIGGERED_ACTION_ENTRY_DRAG_TYPE,
		// Props to collect
		collect: (monitor) => ({
			isOver: monitor.isOver(),
			canDrop: monitor.canDrop(),
		}),
		drop: (item) => {
			if (item.type === TRIGGERED_ACTION_ENTRY_DRAG_TYPE) {
				return {
					overId: triggeredActionId,
					overRank: triggeredAction?._rank,
					overShowStyleBaseId: triggeredAction?.showStyleBaseId,
				}
			}
		},
	})

	const previewItems = useTracker(
		() => {
			try {
				if (triggeredAction && selected && showStyleBase) {
					const executableActions = triggeredAction.actions.map((value) => createAction(value, showStyleBase))
					const ctx = previewContext
					if (ctx && ctx.rundownPlaylist) {
						return flatten(
							executableActions.map((action) => (isPreviewableAction(action) ? action.preview(ctx as any) : []))
						)
					}
				}
			} catch (e) {
				console.error(e)
			}
			return [] as IWrappedAdLib[]
		},
		[selected, triggeredAction],
		[] as IWrappedAdLib[]
	)

	const sourceLayers = showStyleBase ? normalizeArray(showStyleBase.sourceLayers, '_id') : []

	function getType(sourceLayerId: string | undefined): SourceLayerType {
		return sourceLayerId ? sourceLayers[sourceLayerId]?.type ?? SourceLayerType.UNKNOWN : SourceLayerType.UNKNOWN
	}

	function getShortName(sourceLayerId: string | undefined) {
		return sourceLayerId
			? sourceLayers[sourceLayerId]?.abbreviation ?? sourceLayers[sourceLayerId]?.name ?? t('Unknown')
			: t('Unknown')
	}

	const removeTrigger = useCallback(
		(index: number) => {
			if (!triggeredAction) return
			triggeredAction.triggers.splice(index, 1)

			TriggeredActions.update(triggeredActionId, {
				$set: {
					triggers: triggeredAction.triggers,
				},
			})

			setSelectedTrigger(-1)
		},
		[triggeredAction, triggeredActionId]
	)

	const focusTrigger = useCallback(
		(index: number) => {
			if (!triggeredAction) return
			setSelectedTrigger(index)
		},
		[triggeredAction]
	)

	const closeTrigger = useCallback(() => setSelectedTrigger(-1), [])

	const changeTrigger = useCallback(
		(index: number, newVal: DBBlueprintTrigger) => {
			if (!triggeredAction) return
			triggeredAction.triggers.splice(index, 1, newVal)

			LAST_UP_SETTING = !!newVal.up

			TriggeredActions.update(triggeredActionId, {
				$set: {
					triggers: triggeredAction.triggers,
				},
			})

			setSelectedTrigger(-1)
		},
		[triggeredAction, triggeredActionId]
	)

	function addTrigger() {
		if (!triggeredAction) return

		const index =
			triggeredAction.triggers.push({
				type: TriggerType.hotkey,
				keys: '',
				up: LAST_UP_SETTING,
			}) - 1

		TriggeredActions.update(triggeredActionId, {
			$set: {
				triggers: triggeredAction.triggers,
			},
		})

		setSelectedTrigger(index)
		setSelectedAction(-1)
	}

	function addAction() {
		if (!triggeredAction) return
		const index =
			triggeredAction.actions.push({
				action: PlayoutActions.adlib,
				filterChain: [],
			}) - 1

		TriggeredActions.update(triggeredActionId, {
			$set: {
				actions: triggeredAction.actions,
			},
		})

		setSelectedTrigger(-1)
		setSelectedAction(index)
	}

	function removeAction(index: number) {
		if (!triggeredAction) return
		triggeredAction.actions.splice(index, 1)

		TriggeredActions.update(triggeredActionId, {
			$set: {
				actions: triggeredAction.actions,
			},
		})

		setSelectedAction(-1)
	}

	const closeAction = useCallback(() => setSelectedAction(-1), [])
	const focusAction = useCallback(() => props.onFocus && props.onFocus(triggeredActionId), [triggeredActionId])

	useEffect(() => {
		if (!triggeredAction) return

		LAST_UP_SETTING =
			selectedTrigger >= 0
				? !!triggeredAction.triggers[selectedTrigger]?.up
				: triggeredAction.triggers[triggeredAction.triggers.length - 1]?.up ?? LAST_UP_SETTING
	}, [triggeredAction, triggeredAction?.triggers[triggeredAction.triggers.length - 1]?.up, selectedTrigger])

	// do not render anything until we get the triggered action from the collection
	if (!triggeredAction) return null

	return (
		<div
			className={classNames('triggered-action-entry selectable', {
				'selectable-selected': selected,
				'drag-over': isOver,
				dragged: isDragging,
			})}
			ref={(el) => {
				dragPreview(el)
				drop(el)
			}}
			data-obj-id={triggeredAction._id}
		>
			{!selected && !locked ? (
				<div className="triggered-action-entry__drag-handle" ref={drag}>
					{!selected && iconDragHandle()}
				</div>
			) : (
				<div className="triggered-action-entry__drag-handle locked"></div>
			)}
			<div className="triggered-action-entry__triggers">
				{triggeredAction.triggers.map((trigger, index) => (
					<TriggerEditor
						key={index}
						index={index}
						trigger={trigger}
						opened={selectedTrigger === index}
						onChangeTrigger={changeTrigger}
						onFocus={focusTrigger}
						onClose={closeTrigger}
						onRemove={removeTrigger}
					/>
				))}
				<button
					className={classNames('triggered-action-entry__add-trigger', {
						force: triggeredAction.triggers.length === 0,
					})}
					onClick={addTrigger}
				>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
			<div className="triggered-action-entry__actions">
				{triggeredAction.actions.map((action, index) => (
					<ActionEditor
						key={index}
						action={action}
						index={index}
						triggeredAction={triggeredAction}
						showStyleBase={showStyleBase}
						onActionFocus={setSelectedAction}
						onFocus={focusAction}
						onClose={closeAction}
						opened={selectedAction === index}
						onRemove={removeAction}
					/>
				))}
				{triggeredAction.actions.length === 0 ? (
					<div className="triggered-action-entry__action">
						<button className="triggered-action-entry__action-add clickable" onClick={addAction}>
							{t('Select Action')}
						</button>
					</div>
				) : null}
			</div>
			<div className="triggered-action-entry__modify">
				<button className="action-btn" onClick={(e) => onDuplicate(triggeredActionId, e)}>
					<FontAwesomeIcon icon={faCopy} />
				</button>
				<button className="action-btn" onClick={(e) => onEdit(triggeredActionId, e)}>
					<FontAwesomeIcon icon={faPencilAlt} />
				</button>
				<button className="action-btn" onClick={(e) => onRemove(triggeredActionId, e)}>
					<FontAwesomeIcon icon={faTrash} />
				</button>
			</div>
			{selected ? (
				<>
					<ul className="triggered-action-entry__preview">
						{previewItems.map((item) => (
							<li key={item._id as string}>
								<span className={RundownUtils.getSourceLayerClassName(getType(item.sourceLayerId))}>
									{getShortName(item.sourceLayerId)}
								</span>
								{typeof item.label === 'string' ? item.label : translateMessage(item.label, t)}
							</li>
						))}
						{previewItems.length === 0 ? (
							previewContext?.rundownPlaylist ? (
								<span className="placeholder dimmed">
									{t('No Ad-Lib matches in the current state of Rundown: "{{rundownPlaylistName}}"', {
										rundownPlaylistName: previewContext?.rundownPlaylist?.name,
									})}
								</span>
							) : (
								<span className="placeholder dimmed">{t('No matching Rundowns available to be used for preview')}</span>
							)
						) : null}
					</ul>
					<label className="mas">
						<span className="mrs">{t('Label')}</span>
						<EditAttribute
							type="text"
							obj={triggeredAction}
							collection={TriggeredActions}
							attribute="name"
							className="input text-input input-l pan"
							modifiedClassName="bghl"
							mutateDisplayValue={(val) => (typeof val === 'object' ? undefined : val)}
							mutateUpdateValue={(val) =>
								val === '' && typeof triggeredAction.name === 'object' ? triggeredAction.name : val
							}
							label={
								typeof triggeredAction.name === 'object' ? t('Multilingual description, editing will overwrite') : ''
							}
						/>
						<span className="mls text-s dimmed">{t('Optional description of the action')}</span>
					</label>
				</>
			) : null}
		</div>
	)
})
