import * as React from 'react'
import { ClientActions, IAdLibFilterLink, PlayoutActions, SomeAction } from '@sofie-automation/blueprints-integration'
import { TriggeredActions, TriggeredActionsObj } from '../../../../../../lib/collections/TriggeredActions'
import { AdLibFilter } from './filterPreviews/AdLibFilter'
import { assertNever, literal } from '../../../../../../lib/lib'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'i18next'
import { ViewFilter } from './filterPreviews/ViewFilter'
import { RundownPlaylistFilter } from './filterPreviews/RundownPlaylistFilter'
import { ShowStyleBase } from '../../../../../../lib/collections/ShowStyleBases'
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'

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
	const [openIndex, setOpenIndex] = useState(-1)

	function onClose() {
		setOpenIndex(-1)
	}

	function onFilterChange(filterIndex, newVal) {
		action.filterChain.splice(filterIndex, 1, newVal)

		TriggeredActions.update(triggeredAction._id, {
			$set: {
				[`actions.${index}`]: action,
			},
		})
	}

	function onInsertNext(filterIndex) {
		action.filterChain.splice(
			filterIndex + 1,
			0,
			literal<IAdLibFilterLink>({
				object: 'adLib',
				field: 'label',
				value: [],
			})
		)

		TriggeredActions.update(triggeredAction._id, {
			$set: {
				[`actions.${index}`]: action,
			},
		})

		setOpenIndex(filterIndex + 1)
		if (typeof onFocus === 'function') onFocus()
	}

	function onRemove(filterIndex) {
		action.filterChain.splice(filterIndex, 1)

		TriggeredActions.update(triggeredAction._id, {
			$set: {
				[`actions.${index}`]: action,
			},
		})
	}

	function isFinished(): boolean {
		const last = action.filterChain[action.filterChain.length - 1]
		return last?.object === 'adLib' && (last?.field === 'pick' || last?.field === 'pickEnd')
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
						opened={openIndex === index}
						onChange={(newVal) => onFilterChange(index, newVal)}
						showStyleBase={showStyleBase}
						onFocus={() => {
							setOpenIndex(index)
							if (typeof onFocus === 'function') onFocus()
						}}
						onClose={onClose}
						onInsertNext={() => onInsertNext(index)}
						onRemove={() => onRemove(index)}
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
			{!isFinished() ? (
				<button
					className="triggered-action-entry__action__filter-add"
					onClick={() => onInsertNext(action.filterChain.length - 1)}
				>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			) : null}
		</div>
	)
}
