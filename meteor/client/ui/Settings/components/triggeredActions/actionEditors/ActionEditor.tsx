import * as React from 'react'
import { ClientActions, PlayoutActions, SomeAction } from '@sofie-automation/blueprints-integration'
import { TriggeredActions, TriggeredActionsObj } from '../../../../../../lib/collections/TriggeredActions'
import { AdLibFilter } from './filterPreviews/AdLibFilter'
import { assertNever } from '../../../../../../lib/lib'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'i18next'
import { ViewFilter } from './filterPreviews/ViewFilter'
import { RundownPlaylistFilter } from './filterPreviews/RundownPlaylistFilter'
import { ShowStyleBase } from '../../../../../../lib/collections/ShowStyleBases'

interface IProps {
	action: SomeAction
	showStyleBase: ShowStyleBase
	triggeredAction: TriggeredActionsObj
	index: number
	readonly?: boolean
	onFocus?: () => void
}

function actionToLabel(t: TFunction, action: SomeAction['action']): string {
	switch (action) {
		case PlayoutActions.activateRundownPlaylist:
			return t('Activate Rundown')
		case PlayoutActions.adlib:
			return t('AdLib')
		case PlayoutActions.createSnapshotForDebug:
			return t('Store Snapshot')
		case PlayoutActions.deactivateRundownPlaylist:
			return t('Deactivate Rundown')
		case PlayoutActions.disableNextPiece:
			return t('Disable next Piece')
		case PlayoutActions.hold:
			return t('Hold')
		case PlayoutActions.moveNext:
			return t('Move Next')
		case PlayoutActions.reloadRundownPlaylistData:
			return t('Reload NRCS Data')
		case PlayoutActions.resetRundownPlaylist:
			return t('Reset Rundown')
		case PlayoutActions.take:
			return t('Take')
		case PlayoutActions.resyncRundownPlaylist:
			return t('Resync with NRCS')
		case ClientActions.shelf:
			return t('Shelf')
		default:
			assertNever(action)
			return action
	}
}

export const ActionEditor: React.FC<IProps> = function ActionEditor({
	action,
	readonly,
	index,
	triggeredAction,
	showStyleBase,
	onFocus,
}: IProps): React.ReactElement | null {
	const { t } = useTranslation()

	function onFilterChange(newVal, oldVal) {
		const filterIndex = action.filterChain.indexOf(oldVal)
		if (filterIndex >= 0) {
			action.filterChain.splice(filterIndex, 1, newVal)

			TriggeredActions.update(triggeredAction._id, {
				$set: {
					[`actions.${index}`]: action,
				},
			})
		}
	}

	return (
		<div className="triggered-action-entry__action">
			<div className="triggered-action-entry__action__type">{actionToLabel(t, action.action)}</div>
			{action.filterChain.map((chainLink, index) =>
				chainLink.object === 'adLib' ? (
					<AdLibFilter
						link={chainLink}
						readonly={readonly}
						key={index}
						onChange={onFilterChange}
						showStyleBase={showStyleBase}
						onFocus={onFocus}
					/>
				) : chainLink.object === 'view' ? (
					<ViewFilter link={chainLink} key={index} />
				) : chainLink.object === 'rundownPlaylist' ? (
					<RundownPlaylistFilter link={chainLink} key={index} />
				) : (
					<dl className="triggered-action-entry__action__filter" key={index}>
						<dt>{chainLink.object}</dt>
					</dl>
				)
			)}
		</div>
	)
}
