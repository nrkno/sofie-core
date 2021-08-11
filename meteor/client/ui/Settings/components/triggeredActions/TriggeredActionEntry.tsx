import { faPencilAlt, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SourceLayerType, TriggerType } from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'
import * as React from 'react'
import { TriggeredActionsObj } from '../../../../../lib/collections/TriggeredActions'
import { useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { ActionEditor } from './actionEditors/ActionEditor'
import { HotkeyTrigger } from './triggerPreviews/HotkeyTrigger'
import { ShowStyleBase } from '../../../../../lib/collections/ShowStyleBases'
import { flatten, normalizeArray } from '../../../../../lib/lib'
import { createAction, isPreviewableAction } from '../../../../../lib/api/triggers/actionFactory'
import { PreviewContext } from './TriggeredActionsEditor'
import { IWrappedAdLib } from '../../../../../lib/api/triggers/actionFilterChainCompilers'
import { RundownUtils } from '../../../../lib/rundown'
import { useTranslation } from 'react-i18next'
import { translateMessage } from '../../../../../lib/api/TranslatableMessage'

interface IProps {
	showStyleBase: ShowStyleBase
	triggeredAction: TriggeredActionsObj
	selected?: boolean
	previewContext: PreviewContext | null
	onEdit: (e) => void
	onFocus?: () => void
}

export const TriggeredActionEntry: React.FC<IProps> = function TriggeredActionEntry(
	props: IProps
): React.ReactElement | null {
	const { showStyleBase, triggeredAction, selected, previewContext, onEdit } = props

	const { t } = useTranslation()

	const previewItems = useTracker(
		() => {
			if (selected) {
				const executableActions = triggeredAction.actions.map((value) => createAction(value, showStyleBase))
				const ctx = previewContext
				if (ctx && ctx.rundownPlaylist) {
					return flatten(
						executableActions.map((action) => (isPreviewableAction(action) ? action.preview(ctx as any) : []))
					)
				} else {
					return [] as IWrappedAdLib[]
				}
			} else {
				return [] as IWrappedAdLib[]
			}
		},
		[selected, triggeredAction],
		[] as IWrappedAdLib[]
	)

	const sourceLayers = normalizeArray(showStyleBase.sourceLayers, '_id')

	function getType(sourceLayerId: string | undefined): SourceLayerType {
		return sourceLayerId ? sourceLayers[sourceLayerId]?.type ?? SourceLayerType.UNKNOWN : SourceLayerType.UNKNOWN
	}

	function getShortName(sourceLayerId: string | undefined) {
		return sourceLayerId
			? sourceLayers[sourceLayerId]?.abbreviation ?? sourceLayers[sourceLayerId]?.name ?? t('Unknown')
			: t('Unknown')
	}

	return (
		<div
			className={classNames('triggered-action-entry selectable', {
				'selectable-selected': selected,
			})}
		>
			<div className="triggered-action-entry__triggers">
				{triggeredAction.triggers.map((trigger, index) =>
					trigger.type === TriggerType.hotkey ? (
						<HotkeyTrigger key={index} keys={trigger.keys} />
					) : (
						<React.Fragment key={index}>Unknown trigger type: {trigger.type}</React.Fragment>
					)
				)}
			</div>
			<div className="triggered-action-entry__actions">
				{triggeredAction.actions.map((action, index) => (
					<ActionEditor
						key={index}
						action={action}
						index={index}
						triggeredAction={triggeredAction}
						showStyleBase={showStyleBase}
						onFocus={props.onFocus}
					/>
				))}
			</div>
			<div className="triggered-action-entry__modify">
				<button className="action-btn" onClick={onEdit}>
					<FontAwesomeIcon icon={faPencilAlt} />
				</button>
				<button className="action-btn" onClick={() => {}}>
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
								{t('No matches in the current state of Rundown: "{{rundownPlaylistName}}"', {
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
