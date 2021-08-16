import React from 'react'
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
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle, faPlus } from '@fortawesome/free-solid-svg-icons'
import { ActionSelector } from './actionSelector/ActionSelector'
import Tooltip from 'rc-tooltip'
import { useTranslation } from 'react-i18next'

interface IProps {
	action: SomeAction
	showStyleBase: ShowStyleBase
	triggeredAction: TriggeredActionsObj
	index: number
	readonly?: boolean
	opened?: boolean
	onRemove: () => void
	onFocus?: () => void
	onActionFocus?: () => void
	onClose?: () => void
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

export const ActionEditor: React.FC<IProps> = function ActionEditor({
	action,
	readonly,
	index,
	triggeredAction,
	showStyleBase,
	onFocus,
	onActionFocus,
	onRemove,
	onClose: onOuterClose,
	opened,
}: IProps): React.ReactElement | null {
	const [openFilterIndex, setOpenFilterIndex] = useState(-1)
	const { t } = useTranslation()

	function onClose() {
		setOpenFilterIndex(-1)
	}

	function onFilterChange(filterIndex, newVal) {
		action.filterChain.splice(filterIndex, 1, newVal)

		TriggeredActions.update(triggeredAction._id, {
			$set: {
				[`actions.${index}`]: action,
			},
		})
	}

	function onFilterInsertNext(filterIndex) {
		if (filterIndex > -1 || action.filterChain.length === 0) {
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
					[`actions.${index}`]: action,
				},
			})
		}

		setOpenFilterIndex(filterIndex + 1)
		if (typeof onFocus === 'function') onFocus()
	}

	function onFilterRemove(filterIndex) {
		action.filterChain.splice(filterIndex, 1)

		TriggeredActions.update(triggeredAction._id, {
			$set: {
				[`actions.${index}`]: action,
			},
		})
	}

	function onChange(newVal: SomeAction) {
		TriggeredActions.update(triggeredAction._id, {
			$set: {
				[`actions.${index}`]: newVal,
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

	return (
		<div className="triggered-action-entry__action">
			<ActionSelector
				action={action}
				opened={opened}
				onFocus={() => {
					onActionFocus && onActionFocus()
					onFocus && onFocus()
				}}
				onChange={onChange}
				onRemove={onRemove}
				onSetFilter={() => onFilterInsertNext(-1)}
				onClose={onOuterClose}
			/>
			{action.filterChain.map((chainLink, index) =>
				chainLink.object === 'adLib' ? (
					<AdLibFilter
						link={chainLink}
						readonly={readonly}
						key={index}
						opened={openFilterIndex === index}
						onChange={(newVal) => onFilterChange(index, newVal)}
						showStyleBase={showStyleBase}
						onFocus={() => {
							setOpenFilterIndex(index)
							if (typeof onFocus === 'function') onFocus()
						}}
						onClose={onClose}
						onInsertNext={() => onFilterInsertNext(index)}
						onRemove={() => onFilterRemove(index)}
					/>
				) : chainLink.object === 'view' ? (
					<ViewFilter
						link={chainLink}
						key={index}
						final={action.filterChain.length === 1 && isFinal(action, chainLink)}
					/>
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
