import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
// import classNames from 'classnames'
// import Tooltip from 'rc-tooltip'
// import { TOOLTIP_DEFAULT_DELAY } from '../../lib/lib'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { MediaStatus, MediaStatusListItem as IMediaStatusListItem } from '../../MediaStatus/MediaStatus'
import { MediaStatusItem } from './MediaStatusPopUpItem'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { MediaStatusPopUpHeader } from './MediaStatusPopUpHeader'

interface IProps {
	playlistId: RundownPlaylistId
}

/**
 * This is a panel for monitoring the state of all the Media for this Playlist
 */
export function MediaStatusPopUp({ playlistId }: IProps): JSX.Element {
	const { t } = useTranslation()

	const [sortBy, setSortBy] = useState<'rundown' | 'status' | 'sourceLayer' | 'name'>('rundown')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
	// const [filter, setFilter] = useState('')

	function onChangeSort(sortBy: SortBy, sortOrder: SortOrder) {
		setSortOrder(sortOrder === 'inactive' ? 'asc' : sortOrder)
		setSortBy(sortBy)
	}

	const playlistIds = useMemo(() => [playlistId], [playlistId])

	return (
		<div className="media-status-pop-up-panel" role="dialog">
			<div className="media-status-pop-up-panel__inside">
				<h2 className="mhm mvn">{t('Media Status')}</h2>
				<div className="media-status-panel__scrollbox">
					<table className="media-status-panel__table">
						<MediaStatusPopUpHeader sortBy={sortBy} sortOrder={sortOrder} onChange={onChangeSort} />
						<tbody>
							<MediaStatus playlistIds={playlistIds}>
								{(items) => (
									<>
										{items
											.sort((a, b) => sortItems(a, b, sortBy, sortOrder))
											.map((item) => (
												<MediaStatusItem
													key={unprotectString(item._id)}
													label={item.name}
													partId={item.partId}
													partInstanceId={item.partInstanceId}
													partIdentifier={item.partIdentifier}
													segmentIdentifier={item.segmentIdentifier}
													sourceLayerName={item.sourceLayerName}
													sourceLayerType={item.sourceLayerType}
													invalid={item.invalid}
													statusOverlay={item.pieceContentStatus?.messages
														.map((message) => translateMessage(message, t))
														.join(', ')}
													status={item.status}
													isAdLib={item.isAdLib}
												/>
											))}
									</>
								)}
							</MediaStatus>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	)
}

function sortItems(a: IMediaStatusListItem, b: IMediaStatusListItem, sortBy: SortBy, sortOrder: SortOrder) {
	let result = 0
	switch (sortBy) {
		case 'name':
			result = sortByName(a, b)
			break
		case 'status':
			result = sortByStatus(a, b)
			break
		case 'sourceLayer':
			result = sortBySourceLayer(a, b)
			break
		case 'rundown':
			result = sortByRundown(a, b)
			break
		default:
			assertNever(sortBy)
			break
	}

	if (sortOrder === 'desc') return result * -1
	return result
}

function sortByName(a: IMediaStatusListItem, b: IMediaStatusListItem) {
	return a.name.localeCompare(b.name) || sortByRundown(a, b)
}

function sortByStatus(a: IMediaStatusListItem, b: IMediaStatusListItem) {
	return a.status - b.status || sortByRundown(a, b)
}

function sortBySourceLayer(a: IMediaStatusListItem, b: IMediaStatusListItem) {
	if (a.sourceLayerName === b.sourceLayerName) return sortByRundown(a, b)
	if (a.sourceLayerName === undefined) return 1
	if (b.sourceLayerName === undefined) return -1
	return a.sourceLayerName.localeCompare(b.sourceLayerName)
}

function sortByRundown(a: IMediaStatusListItem, b: IMediaStatusListItem) {
	if (a.rundownName === b.rundownName) return sortBySegmentRank(a, b)
	if (a.rundownName === undefined) return 1
	if (b.rundownName === undefined) return -1
	return a.rundownName?.localeCompare(b.rundownName)
}

function sortBySegmentRank(a: IMediaStatusListItem, b: IMediaStatusListItem) {
	if (a.segmentRank === b.segmentRank) return sortByPartRank(a, b)
	return (a.segmentRank ?? 0) - (b.segmentRank ?? 0)
}

function sortByPartRank(a: IMediaStatusListItem, b: IMediaStatusListItem) {
	if (a.partRank === b.partRank) return sortByRank(a, b)
	return (a.partRank ?? 0) - (b.partRank ?? 0)
}

function sortByRank(a: IMediaStatusListItem, b: IMediaStatusListItem) {
	return a.rank - b.rank
}

type SortBy = 'rundown' | 'status' | 'sourceLayer' | 'name'
type SortOrder = 'asc' | 'desc' | 'inactive'
