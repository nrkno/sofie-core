import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
// import classNames from 'classnames'
// import Tooltip from 'rc-tooltip'
// import { TOOLTIP_DEFAULT_DELAY } from '../../lib/lib'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { MediaStatus } from '../../MediaStatus/MediaStatus'
import { TimingDataResolution, TimingTickResolution, withTiming } from '../RundownTiming/withTiming'

interface IProps {
	playlistId: RundownPlaylistId
}

/**
 * This is a panel for monitoring the state of all the Media for this Playlist
 */
export const MediaStatusPopUp = withTiming<IProps, {}>({
	dataResolution: TimingDataResolution.Synced,
	tickResolution: TimingTickResolution.Synced,
})(function MediaStatusPopUp({ playlistId, timingDurations }): JSX.Element {
	const { t } = useTranslation()

	const playlistIds = useMemo(() => [playlistId], [playlistId])

	return (
		<div className="media-status-pop-up-panel" role="dialog">
			<div className="media-status-pop-up-panel__inside">
				<h2 className="mhn mvn">{t('Media Status')}</h2>
				<div className="media-status-panel__scrollbox">
					<table>
						<thead>
							<tr>
								<th>{t('On Air In')}</th>
								<th></th>
								<th></th>
								<th></th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							<MediaStatus playlistIds={playlistIds}>
								{(items) => (
									<>
										<ul>
											{items.map((item) => (
												<li key={unprotectString(item._id)}>
													{item.isAdLib
														? 'AdLib'
														: timingDurations.partCountdown?.[
																unprotectString(item.partInstanceId ?? item.partId) ?? ''
														  ]}
													{item.name}
												</li>
											))}
										</ul>
									</>
								)}
							</MediaStatus>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	)
})
