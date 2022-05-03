import * as React from 'react'
import {
	Translated,
	translateWithTracker,
	useSubscription,
	useTracker,
} from '../../lib/ReactMeteorData/react-meteor-data'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { StudioSelect } from './StudioSelect'
import { StudioId } from '../../../lib/collections/Studios'
import { Mongo } from 'meteor/mongo'
import { TimelineDatastoreEntry } from '../../../lib/collections/TimelineDatastore'
import { PubSub } from '../../../lib/api/pubsub'

const TimelineDatastore = new Mongo.Collection<TimelineDatastoreEntry>('timelineDatastore')

interface ITimelineDatastoreViewProps {
	match?: {
		params?: {
			studioId: StudioId
		}
	}
}
interface ITimelineDatastoreViewState {}
const TimelineDatastoreView = translateWithTracker<ITimelineDatastoreViewProps, ITimelineDatastoreViewState, {}>(
	(_props: ITimelineDatastoreViewProps) => {
		return {}
	}
)(
	class TimelineDatastoreView extends MeteorReactComponent<
		Translated<ITimelineDatastoreViewProps>,
		ITimelineDatastoreViewState
	> {
		constructor(props: Translated<ITimelineDatastoreViewProps>) {
			super(props)
		}

		render() {
			const { t } = this.props

			return (
				<div className="mtl gutter">
					<header className="mvs">
						<h1>{t('Timeline Datastore')}</h1>
					</header>
					<div className="mod mvl">
						{this.props.match && this.props.match.params && (
							<div>
								{/* <ComponentMappingsTable studioId={this.props.match.params.studioId} /> */}
								<ComponentDatastoreControls studioId={this.props.match.params.studioId} />
							</div>
						)}
					</div>
				</div>
			)
		}
	}
)

interface IDatastoreControlsProps {
	studioId: StudioId
}
function ComponentDatastoreControls({ studioId }: IDatastoreControlsProps) {
	useSubscription(PubSub.timelineDatastore, { studioId })

	const datastore = useTracker(() => TimelineDatastore.find().fetch(), [studioId])

	const createOrEdit = (key: string, value: any) => {
		const doc = datastore?.find((entry) => entry.studioId === studioId && entry.key === key)
		if (doc) {
			TimelineDatastore.update(doc._id, {
				$set: {
					value,
					modified: Date.now(),
				},
			})
		} else {
			TimelineDatastore.insert({
				studioId,

				key,
				value,

				modified: Date.now(),
			})
		}
	}

	return (
		<div>
			<div>
				<button className="btn btn-primary" onMouseDown={() => createOrEdit('input', 1)}>
					1
				</button>
				<button className="btn btn-primary" onMouseDown={() => createOrEdit('input', 2)}>
					2
				</button>
				<button className="btn btn-primary" onMouseDown={() => createOrEdit('input', 3)}>
					3
				</button>
			</div>
			<div>{JSON.stringify(datastore)}</div>
		</div>
	)
}

class TimelineDatastoreStudioSelect extends React.Component<{}, {}> {
	render() {
		return <StudioSelect path="timelinedatastore" title="Timeline Datastore" />
	}
}

export { TimelineDatastoreView, TimelineDatastoreStudioSelect }
