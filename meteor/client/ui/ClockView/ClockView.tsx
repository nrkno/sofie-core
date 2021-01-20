import React from 'react'
import { Switch, Route, Redirect } from 'react-router-dom'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'

import { RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'

import { RundownTimingProvider } from '../RundownView/RundownTiming/RundownTimingProvider'
import { WithTiming } from '../RundownView/RundownTiming/withTiming'

import { objectPathGet } from '../../../lib/lib'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'
import { StudioId } from '../../../lib/collections/Studios'
import { StudioScreenSaver } from '../StudioScreenSaver/StudioScreenSaver'
import { PresenterScreen } from './PresenterScreen'
import { OverlayScreen } from './OverlayScreen'
import { OverlayScreenSaver } from './OverlayScreenSaver'

interface IPropsHeader {
	key: string
	playlist: RundownPlaylist
	studioId: StudioId
}

interface IStateHeader {}

export const ClockView = withTracker(function(props: IPropsHeader) {
	let studioId = objectPathGet(props, 'match.params.studioId')
	const playlist = RundownPlaylists.findOne({
		activationId: { $exists: true },
		studioId: studioId,
	})

	return {
		playlist,
		studioId,
	}
})(
	class ClockView extends MeteorReactComponent<WithTiming<IPropsHeader>, IStateHeader> {
		componentDidMount() {
			let studioId = this.props.studioId
			if (studioId) {
				this.subscribe(PubSub.rundownPlaylists, {
					activationId: { exists: true },
					studioId: studioId,
				})
			}
		}

		render() {
			return (
				<Switch>
					<Route path="/countdowns/:studioId/presenter">
						{this.props.playlist ? (
							<RundownTimingProvider playlist={this.props.playlist}>
								<PresenterScreen playlistId={this.props.playlist._id} />
							</RundownTimingProvider>
						) : (
							<StudioScreenSaver studioId={this.props.studioId} />
						)}
					</Route>
					<Route path="/countdowns/:studioId/overlay">
						{this.props.playlist ? (
							<RundownTimingProvider playlist={this.props.playlist}>
								<OverlayScreen playlistId={this.props.playlist._id} />
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
