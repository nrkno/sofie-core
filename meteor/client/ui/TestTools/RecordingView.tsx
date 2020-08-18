import { Meteor } from 'meteor/meteor'
import * as objectPath from 'object-path'
import * as React from 'react'
import { PubSub } from '../../../lib/api/pubsub'
import { RecordedFile, RecordedFiles } from '../../../lib/collections/RecordedFiles'
import { Studio, StudioId, Studios } from '../../../lib/collections/Studios'
import { UserActionsLog, UserActionsLogItem } from '../../../lib/collections/UserActionsLog'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { UserActionsList } from '../Status/UserActivity'

interface IRecordingViewProps {
	match?: {
		params?: {
			studioId: StudioId
			recordingId: string
		}
	}
}
interface IRecordingViewState {}
interface IRecordingViewTrackedProps {
	studio: Studio | undefined
	file: RecordedFile | undefined
	log: UserActionsLogItem[]
}

const RecordingView = translateWithTracker<IRecordingViewProps, IRecordingViewState, IRecordingViewTrackedProps>(
	(props: IRecordingViewProps) => {
		const file = RecordedFiles.findOne({}, { sort: { startedAt: -1 } })

		return {
			studio: Studios.findOne(),
			file,
			log: file
				? UserActionsLog.find(
						{
							timestamp: {
								$gte: file.startedAt,
								$lt: file.stoppedAt,
							},
						},
						{ sort: { timestamp: 1 } }
				  ).fetch()
				: [],
		}
	}
)(
	class RecordingView extends MeteorReactComponent<
		Translated<IRecordingViewProps & IRecordingViewTrackedProps>,
		IRecordingViewState
	> {
		private userActionsLogSub: Meteor.SubscriptionHandle
		private videoPlayer: HTMLVideoElement

		componentDidMount() {
			if (this.props.match && this.props.match.params) {
				// Subscribe to data:
				this.subscribe(PubSub.recordedFiles, {
					studioId: this.props.match.params.studioId,
					_id: this.props.match.params.recordingId,
				})
				this.subscribe(PubSub.studios, {
					_id: this.props.match.params.studioId,
				})
			}
		}

		componentDidUpdate() {
			if (this.props.file && this.props.file.stoppedAt) {
				if (this.userActionsLogSub) {
					this.userActionsLogSub.stop()
				}
				this.userActionsLogSub = this.subscribe(PubSub.userActionsLog, {
					timestamp: {
						$gte: this.props.file.startedAt,
						$lt: this.props.file.stoppedAt,
					},
				})
			}
		}

		setPlayerRef = (el: HTMLVideoElement) => {
			this.videoPlayer = el
		}

		seekToTime = (time: number) => {
			this.videoPlayer.currentTime = time / 1000
		}

		renderRecordingView(file: RecordedFile, studio: Studio) {
			const { t } = this.props

			if (!file) return null

			let urlPrefix = ''
			if (studio) urlPrefix = objectPath.get(studio, 'testToolsConfig.recordings.urlPrefix', '')
			if (urlPrefix === '') {
				return <p>{t('A required setting is not configured')}</p>
			}

			return (
				<React.Fragment>
					<header className="mvs">
						<h1>{file.name}</h1>
					</header>
					<div className="mod mvl">
						{file.stoppedAt ? (
							<video width="960" height="540" controls ref={this.setPlayerRef}>
								<source src={`${urlPrefix}${file.path}`} type="video/mp4" />
								{t('Your browser does not support video playback')}
							</video>
						) : (
							t('Recording still in progress')
						)}
					</div>
					<div className="mod mvl">
						<UserActionsList
							logItems={this.props.log}
							onItemClick={(item) => this.seekToTime(item.timestamp - file.startedAt)}
						/>
					</div>
				</React.Fragment>
			)
		}

		render() {
			const { file, studio } = this.props

			return (
				<div className="mtl gutter">
					{file && studio ? this.renderRecordingView(file, studio) : <p>File not found</p>}
				</div>
			)
		}
	}
)

export { RecordingView }
