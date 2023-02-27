import React from 'react'
import { Switch, Route, Redirect } from 'react-router-dom'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'

import { RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'

import { RundownTimingProvider } from '../RundownView/RundownTiming/RundownTimingProvider'
import { WithTiming } from '../RundownView/RundownTiming/withTiming'

import { objectPathGet } from '../../../lib/lib'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'
import { StudioScreenSaver } from '../StudioScreenSaver/StudioScreenSaver'
import { PresenterScreen } from './PresenterScreen'
import { OverlayScreen } from './OverlayScreen'
import { OverlayScreenSaver } from './OverlayScreenSaver'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface IPropsHeader {
	key: string
	playlist: RundownPlaylist | undefined
	studioId: StudioId
}

interface IStateHeader {}

export const ClockView = withTracker(function (props: IPropsHeader) {
	const studioId = objectPathGet(props, 'match.params.studioId')
	const playlist = RundownPlaylists.findOne({
		activationId: { $exists: true },
		studioId,
	})

	return {
		playlist,
		studioId,
	}
})(
	class ClockView extends MeteorReactComponent<WithTiming<IPropsHeader>, IStateHeader> {
		componentDidMount() {
			const { studioId } = this.props
			if (studioId) {
				this.subscribe(PubSub.rundownPlaylists, {
					activationId: { $exists: true },
					studioId,
				})
			}
		}

		render() {
			return (
				<Switch>
					<Route path="/countdowns/:studioId/presenter">
						{this.props.playlist ? (
							<RundownTimingProvider playlist={this.props.playlist}>
								<PresenterScreen studioId={this.props.studioId} playlistId={this.props.playlist._id} />
							</RundownTimingProvider>
						) : (
							<StudioScreenSaver studioId={this.props.studioId} ownBackground={true} />
						)}
					</Route>
					<Route path="/countdowns/:studioId/overlay">
						{this.props.playlist ? (
							<RundownTimingProvider playlist={this.props.playlist}>
								<OverlayScreen playlistId={this.props.playlist._id} studioId={this.props.studioId} />
							</RundownTimingProvider>
						) : (
							<OverlayScreenSaver studioId={this.props.studioId} />
						)}
					</Route>
					<Route>
						<Redirect to="/" />
					</Route>
				</Switch>
			)
		}
	}
)
