import React, { useCallback, useState } from 'react'
import _ from 'underscore'
import {
	IAdLibFilterLink,
	IGUIContextFilterLink,
	IRundownPlaylistFilterLink,
	PlayoutActions,
	SomeAction,
} from '@sofie-automation/blueprints-integration'
import { TriggeredActions, TriggeredActionsObj } from '../../../../../../lib/collections/TriggeredActions'
import { AdLibFilter } from './filterPreviews/AdLibFilter'
import { literal } from '../../../../../../lib/lib'
import { ViewFilter } from './filterPreviews/ViewFilter'
import { RundownPlaylistFilter } from './filterPreviews/RundownPlaylistFilter'
import { ShowStyleBase } from '../../../../../../lib/collections/ShowStyleBases'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle, faPlus } from '@fortawesome/free-solid-svg-icons'
import { ActionSelector } from './actionSelector/ActionSelector'
import Tooltip from 'rc-tooltip'
import { useTranslation } from 'react-i18next'

interface IProps {
	action: SomeAction
	id: string
	showStyleBase: ShowStyleBase | undefined
	triggeredAction: TriggeredActionsObj
	readonly?: boolean
	opened?: boolean
	onRemove: (id: string) => void
	onFocus?: (id: string) => void
	onActionFocus?: (id: string) => void
	onClose?: (id: string) => void
}

function isFinal(
	action: SomeAction,
	chainLink: IRundownPlaylistFilterLink | IGUIContextFilterLink | IAdLibFilterLink | undefined
): boolean {
	if (action.action === PlayoutActions.adlib) {
		return chainLink?.object === 'adLib' && (chainLink?.field === 'pick' || chainLink?.field === 'pickEnd')
	} else {
		return chainLink?.object === 'view'
	}
}

type ChainLink = IRundownPlaylistFilterLink | IGUIContextFilterLink | IAdLibFilterLink

export const ActionEditor: React.FC<IProps> = function ActionEditor({
	action,
	readonly,
	id,
	triggeredAction,
	showStyleBase,
	onFocus,
	onActionFocus: onOuterActionFocus,
	onRemove: onRemoveAction,
	onClose: onOuterCloseAction,
	opened,
}: IProps): React.ReactElement | null {
	const [openFilterIndex, setOpenFilterIndex] = useState(-1)
	const { t } = useTranslation()

	function onClose() {
		setOpenFilterIndex(-1)
	}

	const onFilterChange = useCallback(
		(filterIndex: number, newVal: ChainLink) => {
			action.filterChain.splice(filterIndex, 1, newVal)

			TriggeredActions.update(triggeredAction._id, {
				$set: {
					[`actionsWithOverrides.defaults.${id}`]: action,
				},
			})
		},
		[action]
	)

	function onFilterInsertNext(filterIndex) {
		if (action.filterChain.length === filterIndex + 1) {
			const obj =
				filterIndex > -1
					? literal<IAdLibFilterLink>({
							object: 'adLib',
							field: 'label',
							value: [],
					  })
					: literal<IGUIContextFilterLink>({
							object: 'view',
					  })

			action.filterChain.splice(filterIndex + 1, 0, obj)

			TriggeredActions.update(triggeredAction._id, {
				$set: {
					[`actionsWithOverrides.defaults.${id}`]: action,
				},
			})
		}

		setOpenFilterIndex(filterIndex + 1)
		if (typeof onFocus === 'function') onFocus(id)
	}

	function onFilterRemove(filterIndex) {
		action.filterChain.splice(filterIndex, 1)

		TriggeredActions.update(triggeredAction._id, {
			$set: {
				[`actionsWithOverrides.defaults.${id}`]: action,
			},
		})
	}

	function onChange(newVal: SomeAction) {
		TriggeredActions.update(triggeredAction._id, {
			$set: {
				[`actionsWithOverrides.defaults.${id}`]: newVal,
			},
		})
	}

	function isFinished(): boolean {
		return isFinal(action, _.last(action.filterChain))
	}

	function isValid(): boolean {
		return (
			action.filterChain.length > 0 &&
			((action.filterChain[0] as IRundownPlaylistFilterLink | IGUIContextFilterLink).object === 'view' ||
				(action.filterChain[0] as IRundownPlaylistFilterLink | IGUIContextFilterLink).object === 'rundownPlaylist')
		)
	}

	const onRemove = useCallback(() => onRemoveAction(id), [id])
	const onOuterClose = useCallback(() => onOuterCloseAction && onOuterCloseAction(id), [id])
	const onActionFocus = useCallback(() => {
		onOuterActionFocus && onOuterActionFocus(id)
		onFocus && onFocus(id)
	}, [onOuterActionFocus, onFocus, id])
	const onSetFilter = useCallback(() => onFilterInsertNext(-1), [onFilterInsertNext])
	const onFilterFocus = useCallback(
		(chainIndex: number) => {
			setOpenFilterIndex(chainIndex)
			onFocus && onFocus(id)
		},
		[onFocus, id]
	)

	return (
		<div className="triggered-action-entry__action">
			<ActionSelector
				action={action}
				opened={opened}
				onFocus={onActionFocus}
				onChange={onChange}
				onRemove={onRemove}
				onSetFilter={onSetFilter}
				onClose={onOuterClose}
			/>
			{action.filterChain.map((chainLink, chainIndex) =>
				chainLink.object === 'adLib' ? (
					<AdLibFilter
						link={chainLink}
						readonly={readonly}
						key={chainIndex}
						index={chainIndex}
						opened={openFilterIndex === chainIndex}
						onChange={onFilterChange}
						showStyleBase={showStyleBase}
						onFocus={onFilterFocus}
						onClose={onClose}
						onInsertNext={onFilterInsertNext}
						onRemove={onFilterRemove}
					/>
				) : chainLink.object === 'view' ? (
					<ViewFilter
						index={chainIndex}
						link={chainLink}
						readonly={readonly}
						key={chainIndex}
						onFocus={onFilterFocus}
						onClose={onClose}
						opened={openFilterIndex === chainIndex}
						final={action.filterChain.length === 1 && isFinal(action, chainLink)}
						onInsertNext={onFilterInsertNext}
						onRemove={onFilterRemove}
					/>
				) : chainLink.object === 'rundownPlaylist' ? (
					<RundownPlaylistFilter link={chainLink} key={chainIndex} />
				) : (
					<dl className="triggered-action-entry__action__filter" key={chainIndex}>
						<dt>{chainLink.object}</dt>
					</dl>
				)
			)}
			{!isFinished() ? (
				<button
					className="triggered-action-entry__action__filter-add"
					onClick={() => onFilterInsertNext(action.filterChain.length - 1)}
				>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			) : null}
			{!isValid() ? (
				<Tooltip overlay={t('This action has an invalid combination of filters')} placement="left">
					<div className="right error-notice">
						<FontAwesomeIcon icon={faExclamationTriangle} />
					</div>
				</Tooltip>
			) : null}
		</div>
	)
}
