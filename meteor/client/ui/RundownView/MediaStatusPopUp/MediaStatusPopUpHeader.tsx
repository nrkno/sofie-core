import React from 'react'
import { useTranslation } from 'react-i18next'
import { SortOrderButton } from '../../MediaStatus/SortOrderButton'
import classNames from 'classnames'

export function MediaStatusPopUpHeader({
	sortOrder,
	sortBy,
	onChange,
}: {
	sortBy: SortBy
	sortOrder: SortOrder
	onChange?: (sortBy: SortBy, sortOrder: SortOrder) => void
}): JSX.Element | null {
	const { t } = useTranslation()

	function changeSortOrder(newSortBy: SortBy, newSortOrder: SortOrder) {
		if (sortBy !== newSortBy) {
			onChange?.(newSortBy, newSortOrder)
			return
		}
		onChange?.(sortBy, newSortOrder)
	}

	return (
		<thead className="media-status-panel-header">
			<tr>
				<th className="media-status-popup-item__playout-indicator"></th>
				<th className="media-status-popup-item__countdown" onClick={() => changeSortOrder('rundown', 'asc')}>
					<button
						className={classNames('media-status-popup-item__sort-button', {
							inactive: sortBy !== 'rundown',
						})}
					>
						{t('On Air In')}
					</button>
				</th>
				<th className="media-status-popup-item__status">
					<SortOrderButton
						className="media-status-popup-item__sort-button"
						order={matchSortKey('status', sortBy, sortOrder)}
						onChange={(order) => changeSortOrder('status', order)}
					/>
				</th>
				<th className="media-status-item__source-layer">
					<SortOrderButton
						className="media-status-popup-item__sort-button"
						order={matchSortKey('sourceLayer', sortBy, sortOrder)}
						onChange={(order) => changeSortOrder('sourceLayer', order)}
					/>
				</th>
				<th className="media-status-item__identifiers"></th>
				<th></th>
			</tr>
		</thead>
	)
}

type SortBy = 'rundown' | 'status' | 'sourceLayer' | 'name'
type SortOrder = 'asc' | 'desc' | 'inactive'

function matchSortKey(sortKey: SortBy, matchSortKey: SortBy, order: SortOrder): SortOrder {
	if (matchSortKey === sortKey) return order
	return 'inactive'
}
