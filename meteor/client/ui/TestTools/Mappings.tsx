import * as React from 'react'
import { Translated, translateWithTracker, withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { omit, Time } from '../../../lib/lib'
import { CustomCollectionName, PubSub } from '../../../lib/api/pubsub'
import { makeTableOfObject } from '../../lib/utilComponents'
import { StudioSelect } from './StudioSelect'
import { RoutedMappings } from '../../../lib/collections/Studios'
import { LookaheadMode, TSR } from '@sofie-automation/blueprints-integration'
import { createCustomPublicationMongoCollection } from '../../../lib/collections/lib'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

const StudioMappings = createCustomPublicationMongoCollection(CustomCollectionName.StudioMappings)

interface IMappingsViewProps {
	match?: {
		params?: {
			studioId: StudioId
		}
	}
}
interface IMappingsViewState {}
const MappingsView = translateWithTracker<IMappingsViewProps, IMappingsViewState, {}>((_props: IMappingsViewProps) => {
	return {}
})(
	class MappingsView extends MeteorReactComponent<Translated<IMappingsViewProps>, IMappingsViewState> {
		constructor(props: Translated<IMappingsViewProps>) {
			super(props)
		}

		render() {
			const { t } = this.props

			return (
				<div className="mtl gutter">
					<header className="mvs">
						<h1>{t('Routed Mappings')}</h1>
					</header>
					<div className="mod mvl">
						{this.props.match && this.props.match.params && (
							<div>
								<ComponentMappingsTable studioId={this.props.match.params.studioId} />
							</div>
						)}
					</div>
				</div>
			)
		}
	}
)

interface IMappingsTableProps {
	studioId: StudioId
}
interface IMappingsTableTrackedProps {
	mappings: RoutedMappings | null
}
interface IMappingsTableState {
	time: Time | null
}
export const ComponentMappingsTable = withTracker<IMappingsTableProps, IMappingsTableState, IMappingsTableTrackedProps>(
	(props: IMappingsTableProps) => {
		try {
			// These properties will be exposed under this.props
			// Note that these properties are reactively recalculated
			const mappings = StudioMappings.findOne(props.studioId)
			return {
				mappings: mappings || null,
			}
		} catch (e) {
			return {
				mappings: null,
			}
		}
	}
)(
	class ComponentMappingsTable extends MeteorReactComponent<
		IMappingsTableProps & IMappingsTableTrackedProps,
		IMappingsTableState
	> {
		constructor(props: IMappingsTableProps & IMappingsTableTrackedProps) {
			super(props)

			this.state = {
				time: null,
			}
		}
		componentDidMount() {
			this.subscribe(PubSub.mappingsForStudio, this.props.studioId)
		}
		renderMappingsState(state: RoutedMappings) {
			const rows = _.sortBy(Object.entries(state.mappings), (o) => o[0])
			return rows.map(([id, obj]) => (
				<tr key={id}>
					<td>{id}</td>
					<td>{obj.deviceId}</td>
					<td>{TSR.DeviceType[obj.device]}</td>
					<td>{obj.layerName}</td>
					<td>
						Mode: {LookaheadMode[obj.lookahead]}
						<br />
						Distance: {obj.lookaheadMaxSearchDistance}
						<br />
						Depth: {obj.lookaheadDepth}
					</td>
					<td>
						{makeTableOfObject(
							omit(obj, 'deviceId', 'device', 'lookahead', 'lookaheadDepth', 'lookaheadMaxSearchDistance', 'layerName')
						)}
					</td>
				</tr>
			))
		}
		render() {
			const { mappings } = this.props
			return (
				<div>
					<div>
						<div>
							<table className="testtools-timelinetable">
								<tbody>
									<tr>
										<th>Mapping</th>
										<th>DeviceId</th>
										<th>Type</th>
										<th>Name</th>
										<th>Lookahead</th>
										<th>Data</th>
									</tr>
									{mappings ? this.renderMappingsState(mappings) : ''}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)
		}
	}
)

class MappingsStudioSelect extends React.Component<{}, {}> {
	render() {
		return <StudioSelect path="mappings" title="Mappings" />
	}
}

export { MappingsView, MappingsStudioSelect }
