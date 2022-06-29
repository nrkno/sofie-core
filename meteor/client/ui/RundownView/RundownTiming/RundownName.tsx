import React from 'react'
import { WithTranslation, withTranslation } from 'react-i18next'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { withTiming, WithTiming } from './withTiming'
import ClassNames from 'classnames'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { LoopingIcon } from '../../../lib/ui/icons/looping'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { RundownUtils } from '../../../lib/rundown'
import { getCurrentTime } from '../../../../lib/lib'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'

interface IRundownNameProps {
	rundownPlaylist: RundownPlaylist
	currentRundown?: Rundown
	rundownCount: number
	hideDiff?: boolean
}

export const RundownName = withTranslation()(
	withTiming<IRundownNameProps & WithTranslation, {}>()(
		class RundownName extends React.Component<Translated<WithTiming<IRundownNameProps>>> {
			render() {
				const { rundownPlaylist, currentRundown, rundownCount, t } = this.props
				const playlistStartTime = PlaylistTiming.getExpectedStart(rundownPlaylist.timing)

				return (
					<span
						className={ClassNames('timing-clock countdown left', {
							'plan-start': !(
								rundownPlaylist.startedPlayback &&
								rundownPlaylist.activationId &&
								!rundownPlaylist.activationId
							),
							'playback-started': !(
								rundownPlaylist.startedPlayback &&
								rundownPlaylist.activationId &&
								!rundownPlaylist.activationId
							),
							heavy: playlistStartTime && getCurrentTime() > playlistStartTime,
						})}
					>
						{currentRundown && (rundownPlaylist.name !== currentRundown.name || rundownCount > 1) ? (
							<span
								className="timing-clock-label left hide-overflow rundown-name"
								title={
									rundownPlaylist.loop
										? t('{{currentRundownName}} - {{rundownPlaylistName}} (Looping)', {
												currentRundownName: currentRundown.name,
												rundownPlaylistName: rundownPlaylist.name,
										  })
										: t('{{currentRundownName}} - {{rundownPlaylistName}}', {
												currentRundownName: currentRundown.name,
												rundownPlaylistName: rundownPlaylist.name,
										  })
								}
								id="rundown-playlist-name"
							>
								{rundownPlaylist.loop && <LoopingIcon />} <strong>{currentRundown.name}</strong> {rundownPlaylist.name}
							</span>
						) : (
							<span
								className="timing-clock-label left hide-overflow rundown-name"
								title={
									rundownPlaylist.loop
										? t('{{rundownPlaylistName}} (Looping)', {
												rundownPlaylistName: rundownPlaylist.name,
										  })
										: rundownPlaylist.name
								}
								id="rundown-playlist-name"
							>
								{rundownPlaylist.loop && <LoopingIcon />} {rundownPlaylist.name}
							</span>
						)}
						{!this.props.hideDiff &&
						rundownPlaylist.startedPlayback &&
						rundownPlaylist.activationId &&
						!rundownPlaylist.rehearsal
							? playlistStartTime &&
							  RundownUtils.formatDiffToTimecode(
									rundownPlaylist.startedPlayback - playlistStartTime,
									true,
									false,
									true,
									true,
									true
							  )
							: playlistStartTime &&
							  RundownUtils.formatDiffToTimecode(getCurrentTime() - playlistStartTime, true, false, true, true, true)}
					</span>
				)
			}
		}
	)
)
