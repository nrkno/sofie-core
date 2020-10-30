import * as React from 'react'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { withTranslation, WithTranslation } from 'react-i18next'
import * as _ from 'underscore'

import { RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'

import { RundownTimingProvider, WithTiming } from '../RundownView/RundownTiming'

import { objectPathGet } from '../../../lib/lib'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'
import { StudioId } from '../../../lib/collections/Studios'
import { StudioScreenSaver } from '../StudioScreenSaver/StudioScreenSaver'
import { ClockComponent } from './ClockComponent'

interface IPropsHeader extends WithTranslation {
	key: string
	playlist: RundownPlaylist
	studioId: StudioId
}

interface IStateHeader {}

export const ClockView = withTranslation()(
	withTracker(function(props: IPropsHeader) {
		let studioId = objectPathGet(props, 'match.params.studioId')
		const playlist = RundownPlaylists.findOne(
			{
				active: true,
				studioId: studioId,
			},
			{
				fields: {
					_id: 1,
				},
			}
		)

		console.log(playlist)

		return {
			playlist,
			studioId,
		}
	})(
		class ClockView extends MeteorReactComponent<WithTiming<IPropsHeader>, IStateHeader> {
			componentDidMount() {
				document.body.classList.add('dark', 'xdark')
				let studioId = this.props.studioId
				if (studioId) {
					this.subscribe(PubSub.rundownPlaylists, {
						active: true,
						studioId: studioId,
					})
				}
			}

			componentWillUnmount() {
				this._cleanUp()
				document.body.classList.remove('dark', 'xdark')
			}

			render() {
				const { t } = this.props

				if (this.props.playlist) {
					return (
						<RundownTimingProvider playlist={this.props.playlist}>
							<ClockComponent playlistId={this.props.playlist._id} />
						</RundownTimingProvider>
					)
				} else {
					return <StudioScreenSaver studioId={this.props.studioId} />
				}
			}
		}
	)
)
