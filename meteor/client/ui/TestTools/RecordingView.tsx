import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RecordedFile, RecordedFiles } from '../../../lib/collections/RecordedFiles'

interface IEvaluationProps {
	match?: {
		params?: {
			studioId: string
			recordingId: string
		}
	}
}
interface IEvaluationState {
}
interface IEvaluationTrackedProps {
	file: RecordedFile | undefined
}

const RecordingView = translateWithTracker<IEvaluationProps, IEvaluationState, IEvaluationTrackedProps>((props: IEvaluationProps) => {
	return {
		file: RecordedFiles.findOne({}, { sort: { startedAt: -1 } })
	}
})(class RecordingView extends MeteorReactComponent<Translated<IEvaluationProps & IEvaluationTrackedProps>, IEvaluationState> {

	componentWillMount () {
		if (this.props.match && this.props.match.params) {
			// Subscribe to data:
			this.subscribe('recordedFiles', {
				studioId: this.props.match.params.studioId,
				_id: this.props.match.params.recordingId
			})
		}
	}

	renderRecordingView () {
		const { t, file } = this.props

		if (!file) return <React.Fragment></React.Fragment>

		return <React.Fragment>
			<header className='mvs'>
					<h1>{file.name}</h1>
				</header>
				<div className='mod mvl'>
					<p>TODO</p>
				</div>
		</React.Fragment>
	}

	render () {
		const { t, file } = this.props

		return <React.Fragment>
			<div className='mtl gutter'>
				{ file ? this.renderRecordingView() : (
					<p>File not found</p>
				)}
			</div>
		</React.Fragment>
	}
})

export { RecordingView }
