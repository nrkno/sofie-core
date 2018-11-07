import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RecordedFile, RecordedFiles } from '../../../lib/collections/RecordedFiles'
import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'
import * as objectPath from 'object-path'

interface IRecordingViewProps {
	match?: {
		params?: {
			studioId: string
			recordingId: string
		}
	}
}
interface IRecordingViewState {
}
interface IRecordingViewTrackedProps {
	studio: StudioInstallation | undefined
	file: RecordedFile | undefined
}

const RecordingView = translateWithTracker<IRecordingViewProps, IRecordingViewState, IRecordingViewTrackedProps>((props: IRecordingViewProps) => {
	return {
		studio: StudioInstallations.findOne(),
		file: RecordedFiles.findOne({}, { sort: { startedAt: -1 } })
	}
})(class RecordingView extends MeteorReactComponent<Translated<IRecordingViewProps & IRecordingViewTrackedProps>, IRecordingViewState> {

	componentWillMount () {
		if (this.props.match && this.props.match.params) {
			// Subscribe to data:
			this.subscribe('recordedFiles', {
				studioId: this.props.match.params.studioId,
				_id: this.props.match.params.recordingId
			})
			this.subscribe('studioInstallations', {
				_id: this.props.match.params.studioId
			})
		}
	}

	renderRecordingView () {
		const { t, file, studio } = this.props

		if (!file) return null

		let urlPrefix = ''
		if (studio) urlPrefix = objectPath.get(studio, 'testToolsConfig.recordings.urlPrefix', '')
		if (urlPrefix === '') {
			return <p>{t('A required setting is not configured')}</p>
		}

		return <React.Fragment>
			<header className='mvs'>
				<h1>{file.name}</h1>
			</header>
			<div className='mod mvl'>
				{ file.stoppedAt
					? <video width='960' height='540' controls>
						<source src={`${urlPrefix}${file.path}`} type='video/mp4' />
						{t('Your browser does not support video playback')}
					</video>
					: t('Recording still in progress')
				}
			</div>
		</React.Fragment>
	}

	render () {
		const { t, file } = this.props

		return <div className='mtl gutter'>
			{ file ? this.renderRecordingView() : (
				<p>File not found</p>
			)}
		</div>
	}
})

export { RecordingView }
