import React, { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	MediaStatus as MediaStatusComponent,
	MediaStatusListItem as IMediaStatusListItem,
} from '../../MediaStatus/MediaStatus'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { RundownPlaylists } from '../../../collections'
import { PubSub } from '../../../../lib/api/pubsub'
import { Spinner } from '../../../lib/Spinner'
import { MediaStatusListItem } from './MediaStatusListItem'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { useTranslation } from 'react-i18next'
import { MediaStatusListHeader } from './MediaStatusListHeader'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'
import { mapOrFallback } from '../../../lib/lib'

export function MediaStatus(): JSX.Element | null {
	const scrollBox = useRef<HTMLDivElement>(null)
	const [offsetTop, setOffsetTop] = useState(0)

	const [sortBy, setSortBy] = useState<'rundown' | 'status' | 'sourceLayer' | 'name'>('rundown')
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
	const [filter, setFilter] = useState('')

	const playlistIds = useTracker(() => RundownPlaylists.find().map((playlist) => playlist._id), [], [])

	function onChangeSort(sortBy: SortBy, sortOrder: SortOrder) {
		setSortOrder(sortOrder === 'inactive' ? 'asc' : sortOrder)
		setSortBy(sortBy)
	}

	useSubscription(PubSub.rundownPlaylists, {})

	const { t } = useTranslation()

	useEffect(() => {
		if (!scrollBox.current) return

		setOffsetTop(scrollBox.current.offsetTop)
	}, [])

	const emptyFilter = !filter || filter.trim().length === 0

	const filterItems = useCallback(
		(item: IMediaStatusListItem) => {
			if (emptyFilter) return true
			if (item.name.toLowerCase().indexOf(filter.toLowerCase().trim()) >= 0) return true
			return false
		},
		[filter, emptyFilter]
	)

	const scrollBoxStyle = useMemo<CSSProperties>(
		() => ({
			maxHeight: offsetTop ? `calc(100vh - ${offsetTop}px)` : undefined,
		}),
		[offsetTop]
	)

	return (
		<div className="mhl gutter">
			<header className="mbs">
				<div className="media-status-table-search">
					<input
						className="media-status-table-search__search-input"
						type="search"
						value={filter}
						placeholder="Filter…"
						onChange={(e) => setFilter(e.target.value)}
					/>
					{filter && (
						<div className="media-status-table-search__clear-search-input" onClick={() => setFilter('')}>
							<FontAwesomeIcon icon={faTimes} />
						</div>
					)}
				</div>
				<h1>{t('Media Status')}</h1>
			</header>
			<div className="media-status-table-scrollbox mlm prs" ref={scrollBox} style={scrollBoxStyle}>
				<table className="media-status-table mbl">
					<MediaStatusListHeader sortOrder={sortOrder} sortBy={sortBy} onChange={onChangeSort} />
					<tbody>
						<MediaStatusComponent
							playlistIds={playlistIds}
							fallback={
								<tr>
									<td colSpan={6} className="media-status-list-message">
										<Spinner />
									</td>
								</tr>
							}
						>
							{(items) => (
								<>
									{mapOrFallback(
										items.filter((item) => filterItems(item)).sort((a, b) => sortItems(a, b, sortBy, sortOrder)),
										(item) => (
											<MediaStatusListItem
												rundownName={item.playlistName}
												rundownTo={`/rundown/${item.playlistId}`}
												status={item.status}
												statusOverlay={item.pieceContentStatus?.messages
													.map((message) => translateMessage(message, t))
													.join(', ')}
												sourceLayerType={item.sourceLayerType}
												sourceLayerName={item.sourceLayerName}
												partIdentifier={item.partIdentifier}
												segmentIdentifier={item.segmentIdentifier}
												invalid={item.invalid}
												key={unprotectString(item._id)}
												label={item.name}
												duration={item.duration}
											/>
										),
										() => (
											<tr>
												<td colSpan={6} className="media-status-list-message">
													{emptyFilter ? t('No Media required by this system') : t('No Media matches this filter')}
												</td>
											</tr>
										)
									)}
								</>
							)}
						</MediaStatusComponent>
					</tbody>
				</table>
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
