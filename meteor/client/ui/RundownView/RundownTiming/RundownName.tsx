import React from 'react'
import { WithTranslation, withTranslation } from 'react-i18next'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { withTiming, WithTiming } from './withTiming'
import ClassNames from 'classnames'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { LoopingIcon } from '../../../lib/ui/icons/looping'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownUtils } from '../../../lib/rundown'
import { getCurrentTime } from '../../../../lib/lib'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'

interface IRundownNameProps {
	rundownPlaylist: DBRundownPlaylist
	currentRundown?: Rundown
	rundownCount: number
	hideDiff?: boolean
}

export const RundownName = withTranslation()(
	withTiming<IRundownNameProps & WithTranslation, {}>()(
		class RundownName extends React.Component<Translated<WithTiming<IRundownNameProps>>> {
			render(): JSX.Element {
				const { rundownPlaylist, currentRundown, rundownCount, t } = this.props
				const expectedStart = PlaylistTiming.getExpectedStart(rundownPlaylist.timing)
				return (
					<div
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
							heavy: expectedStart && getCurrentTime() > expectedStart,
						})}
					>
						{currentRundown && (rundownPlaylist.name !== currentRundown.name || rundownCount > 1) ? (
							<h1
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
							</h1>
						) : (
							<h1
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
							</h1>
						)}
						{!this.props.hideDiff &&
						rundownPlaylist.startedPlayback &&
						rundownPlaylist.activationId &&
						!rundownPlaylist.rehearsal
							? expectedStart &&
							  RundownUtils.formatDiffToTimecode(
									rundownPlaylist.startedPlayback - expectedStart,
									true,
									false,
									true,
									true,
									true
							  )
							: expectedStart &&
							  RundownUtils.formatDiffToTimecode(getCurrentTime() - expectedStart, true, false, true, true, true)}
					</div>
				)
			}
		}
	)
)
