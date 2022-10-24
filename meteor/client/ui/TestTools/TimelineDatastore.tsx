import * as React from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { StudioSelect } from './StudioSelect'
import { Mongo } from 'meteor/mongo'
import { TimelineDatastoreEntry } from '../../../lib/collections/TimelineDatastore'
import { PubSub } from '../../../lib/api/pubsub'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

const TimelineDatastore = new Mongo.Collection<TimelineDatastoreEntry>('timelineDatastore')

interface TimelineDatastoreViewRouteParams {
	studioId: string
}

const TimelineDatastoreView: React.FC = function TimelineDatastoreView() {
	const { t } = useTranslation()
	const { studioId } = useParams<TimelineDatastoreViewRouteParams>()

	return (
		<div className="mtl gutter">
			<header className="mvs">
				<h1>{t('Timeline Datastore')}</h1>
			</header>
			<div className="mod mvl">
				{studioId && (
					<div>
						<ComponentDatastoreControls studioId={protectString(studioId)} />
					</div>
				)}
			</div>
		</div>
	)
}

interface IDatastoreControlsProps {
	studioId: StudioId
}
function ComponentDatastoreControls({ studioId }: IDatastoreControlsProps) {
	useSubscription(PubSub.timelineDatastore, studioId)

	const datastore = useTracker(() => TimelineDatastore.find().fetch(), [studioId])

	return (
		<div>
			<div>
				<table className="testtools-timelinetable">
					<tbody>
						<tr>
							<th>Key</th>
							<th>Last modified</th>
							<th>Type</th>
							<th>Value</th>
						</tr>
						{datastore?.map((entry) => (
							<tr key={unprotectString(entry._id)}>
								<td>{entry.key}</td>
								<td>{entry.modified}</td>
								<td>{entry.mode}</td>
								<td>{entry.value}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}

const TimelineDatastoreStudioSelect: React.FC = function TimelineDatastoreStudioSelect() {
	return <StudioSelect path="timelinedatastore" title="Timeline Datastore" />
}

export { TimelineDatastoreView, TimelineDatastoreStudioSelect }
