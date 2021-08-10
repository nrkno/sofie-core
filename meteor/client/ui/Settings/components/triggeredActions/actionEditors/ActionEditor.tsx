import * as React from 'react'
import { ClientActions, PlayoutActions, SomeAction } from '@sofie-automation/blueprints-integration'
import { TriggeredActionsObj } from '../../../../../../lib/collections/TriggeredActions'
import { AdLibFilter } from './filterPreviews/AdLibFilter'
import { assertNever } from '../../../../../../lib/lib'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'i18next'

interface IProps {
	action: SomeAction
	triggeredAction: TriggeredActionsObj
	index: number
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

export const ActionEditor: React.FC<IProps> = function ActionEditor({ action }: IProps): React.ReactElement | null {
	const { t } = useTranslation()
	return (
		<div className="triggered-action-entry__action">
			<div className="triggered-action-entry__action__type">{actionToLabel(t, action.action)}</div>
			{action.filterChain.map((chainLink, index) => (
				<dl className="triggered-action-entry__action__filter" key={index}>
					{chainLink.object === 'adLib' ? <AdLibFilter link={chainLink} /> : <dt>{chainLink.object}</dt>}
				</dl>
			))}
		</div>
	)
}
