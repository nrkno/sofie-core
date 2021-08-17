import React, { useState } from 'react'
import { faPencilAlt, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PlayoutActions, SourceLayerType, TriggerType } from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'
import {
	DBBlueprintTrigger,
	TriggeredActions,
	TriggeredActionsObj,
} from '../../../../../lib/collections/TriggeredActions'
import { useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { ActionEditor } from './actionEditors/ActionEditor'
import { ShowStyleBase } from '../../../../../lib/collections/ShowStyleBases'
import { flatten, normalizeArray } from '../../../../../lib/lib'
import { createAction, isPreviewableAction } from '../../../../../lib/api/triggers/actionFactory'
import { PreviewContext } from './TriggeredActionsEditor'
import { IWrappedAdLib } from '../../../../../lib/api/triggers/actionFilterChainCompilers'
import { RundownUtils } from '../../../../lib/rundown'
import { useTranslation } from 'react-i18next'
import { translateMessage } from '../../../../../lib/api/TranslatableMessage'
import { TriggerEditor } from './triggerEditors/TriggerEditor'
import { useEffect } from 'react'

interface IProps {
	showStyleBase: ShowStyleBase | undefined
	triggeredAction: TriggeredActionsObj
	selected?: boolean
	previewContext: PreviewContext | null
	onEdit: (e) => void
	onRemove: (e) => void
	onFocus?: () => void
}

let LAST_UP_SETTING = false

export const TriggeredActionEntry: React.FC<IProps> = function TriggeredActionEntry(
	props: IProps
): React.ReactElement | null {
	const { showStyleBase, triggeredAction, selected, previewContext, onEdit, onRemove } = props

	const { t } = useTranslation()
	const [selectedTrigger, setSelectedTrigger] = useState(-1)
	const [selectedAction, setSelectedAction] = useState(-1)

	const previewItems = useTracker(
		() => {
			try {
				if (selected && showStyleBase) {
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

	function removeTrigger(index: number) {
		triggeredAction.triggers.splice(index, 1)

		TriggeredActions.update(triggeredAction._id, {
			$set: {
				triggers: triggeredAction.triggers,
			},
		})

		setSelectedTrigger(-1)
	}

	function changeTrigger(index: number, newVal: DBBlueprintTrigger) {
		triggeredAction.triggers.splice(index, 1, newVal)

		LAST_UP_SETTING = !!newVal.up

		TriggeredActions.update(triggeredAction._id, {
			$set: {
				triggers: triggeredAction.triggers,
			},
		})

		setSelectedTrigger(-1)
	}

	function addTrigger() {
		const index =
			triggeredAction.triggers.push({
				type: TriggerType.hotkey,
				keys: '',
				up: LAST_UP_SETTING,
			}) - 1

		TriggeredActions.update(triggeredAction._id, {
			$set: {
				triggers: triggeredAction.triggers,
			},
		})

		setSelectedTrigger(index)
		setSelectedAction(-1)
	}

	function addAction() {
		const index =
			triggeredAction.actions.push({
				action: PlayoutActions.adlib,
				filterChain: [],
			}) - 1

		TriggeredActions.update(triggeredAction._id, {
			$set: {
				actions: triggeredAction.actions,
			},
		})

		setSelectedTrigger(-1)
		setSelectedAction(index)
	}

	function removeAction(index: number) {
		triggeredAction.actions.splice(index, 1)

		TriggeredActions.update(triggeredAction._id, {
			$set: {
				actions: triggeredAction.actions,
			},
		})

		setSelectedAction(-1)
	}

	useEffect(() => {
		LAST_UP_SETTING =
			selectedTrigger >= 0
				? !!triggeredAction.triggers[selectedTrigger]?.up
				: triggeredAction.triggers[triggeredAction.triggers.length - 1]?.up ?? LAST_UP_SETTING
	}, [triggeredAction.triggers[triggeredAction.triggers.length - 1]?.up, selectedTrigger])

	return (
		<div
			className={classNames('triggered-action-entry selectable', {
				'selectable-selected': selected,
			})}
		>
			<div className="triggered-action-entry__triggers">
				{triggeredAction.triggers.map((trigger, index) => (
					<TriggerEditor
						key={index}
						trigger={trigger}
						opened={selectedTrigger === index}
						onChangeTrigger={(newVal) => changeTrigger(index, newVal)}
						onFocus={() => setSelectedTrigger(index)}
						onClose={() => setSelectedTrigger(-1)}
						onRemove={() => removeTrigger(index)}
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
						onActionFocus={() => setSelectedAction(index)}
						onFocus={props.onFocus}
						onClose={() => setSelectedAction(-1)}
						opened={selectedAction === index}
						onRemove={() => removeAction(index)}
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
				<button className="action-btn" onClick={onEdit}>
					<FontAwesomeIcon icon={faPencilAlt} />
				</button>
				<button className="action-btn" onClick={onRemove}>
					<FontAwesomeIcon icon={faTrash} />
				</button>
			</div>
			{selected ? (
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
			) : null}
		</div>
	)
}
