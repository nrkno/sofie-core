import * as _ from 'underscore'
import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { Blueprints } from '../../../lib/collections/Blueprints'
import { ShowStyleBase, ShowStyleBases, ShowStyleBaseId } from '../../../lib/collections/ShowStyleBases'
import { ShowStyleVariants, ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import RundownLayoutEditor from './RundownLayoutEditor'
import { Studio, Studios, MappingsExt } from '../../../lib/collections/Studios'
import { BlueprintManifestType, ConfigManifestEntry } from '@sofie-automation/blueprints-integration'
import { ConfigManifestSettings } from './ConfigManifestSettings'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { TriggeredActionsEditor } from './components/triggeredActions/TriggeredActionsEditor'
import { SourceLayerSettings } from './ShowStyle/SourceLayer'
import { OutputLayerSettings } from './ShowStyle/OutputLayer'
import { HotkeyLegendSettings } from './ShowStyle/HotkeyLegend'
import { ShowStyleVariantsSettings } from './ShowStyle/VariantSettings'
import { ShowStyleGenericProperties } from './ShowStyle/Generic'
import { Switch, Route, Redirect } from 'react-router-dom'
import { ErrorBoundary } from '../../lib/ErrorBoundary'

interface IProps {
	match: {
		url: string
		path: string
		params: {
			showStyleBaseId: ShowStyleBaseId
		}
	}
}
interface IState {
	uploadFileKey: number // Used to force clear the input after use
	showUploadConfirm: boolean
	uploadFileName?: string
	uploadFileContents?: string
}
interface ITrackedProps {
	showStyleBase?: ShowStyleBase
	showStyleVariants: Array<ShowStyleVariant>
	compatibleStudios: Array<Studio>
	blueprintConfigManifest: ConfigManifestEntry[]
}
export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	const showStyleBase = ShowStyleBases.findOne(props.match.params.showStyleBaseId)
	const compatibleStudios = showStyleBase
		? Studios.find({
				supportedShowStyleBase: {
					$in: [showStyleBase._id],
				},
		  }).fetch()
		: []
	const blueprint = showStyleBase
		? Blueprints.findOne({
				_id: showStyleBase.blueprintId,
				blueprintType: BlueprintManifestType.SHOWSTYLE,
		  })
		: undefined

	return {
		showStyleBase: showStyleBase,
		showStyleVariants: showStyleBase
			? ShowStyleVariants.find({
					showStyleBaseId: showStyleBase._id,
			  }).fetch()
			: [],
		compatibleStudios: compatibleStudios,
		blueprintConfigManifest: blueprint ? blueprint.showStyleConfigManifest || [] : [],
	}
})(
	class ShowStyleBaseSettings extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
		constructor(props: Translated<IProps & ITrackedProps>) {
			super(props)
			this.state = {
				uploadFileKey: Date.now(),
				showUploadConfirm: false,
			}
		}

		onUploadFile(e) {
			const file = e.target.files[0]
			if (!file) {
				return
			}

			const reader = new FileReader()
			reader.onload = (e2) => {
				this.setState({
					uploadFileKey: Date.now(),
					showUploadConfirm: true,
					uploadFileName: file.name,
					uploadFileContents: (e2.target as any).result,
				})
			}

			reader.readAsText(file)
		}

		getLayerMappingsFlat() {
			const mappings: { [key: string]: MappingsExt } = {}
			_.each(this.props.compatibleStudios, (studio) => {
				mappings[studio.name] = studio.mappings
			})
			return mappings
		}

		getSourceLayersFlat() {
			if (this.props.showStyleBase) {
				return _.map(this.props.showStyleBase.sourceLayers, (layer) => {
					return {
						value: layer._id,
						name: layer.name,
						type: layer.type,
					}
				})
			} else {
				return []
			}
		}

		renderEditForm(showStyleBase: ShowStyleBase) {
			const { t } = this.props

			const layerMappings = this.getLayerMappingsFlat()
			const sourceLayers = this.getSourceLayersFlat()

			return (
				<div className="studio-edit mod mhl mvn">
					<div className="row">
						<div className="col c12 r1-c12">
							<ErrorBoundary>
								<Switch>
									<Route path={`${this.props.match.path}/generic`}>
										<ShowStyleGenericProperties
											showStyleBase={showStyleBase}
											compatibleStudios={this.props.compatibleStudios}
										/>
									</Route>
									<Route path={`${this.props.match.path}/layers`}>
										<div className="row">
											<div className="col c12 rl-c6">
												<SourceLayerSettings showStyleBase={showStyleBase} />
											</div>
											<div className="col c12 rl-c6">
												<OutputLayerSettings showStyleBase={showStyleBase} />
											</div>
										</div>
									</Route>
									<Route path={`${this.props.match.path}/action-triggers`}>
										<TriggeredActionsEditor showStyleBaseId={showStyleBase._id} />
									</Route>
									<Route path={`${this.props.match.path}/hotkey-labels`}>
										<HotkeyLegendSettings showStyleBase={showStyleBase} />
									</Route>

									{RundownLayoutsAPI.getSettingsManifest(t).map((region) => {
										return (
											<Route key={region._id} path={`${this.props.match.path}/layouts-${region._id}`}>
												<RundownLayoutEditor
													showStyleBase={showStyleBase}
													studios={this.props.compatibleStudios}
													customRegion={region}
												/>
											</Route>
										)
									})}

									<Route path={`${this.props.match.path}/blueprint-config`}>
										<ConfigManifestSettings
											t={this.props.t}
											i18n={this.props.i18n}
											tReady={this.props.tReady}
											manifest={this.props.blueprintConfigManifest}
											object={showStyleBase}
											collection={ShowStyleBases}
											layerMappings={layerMappings}
											sourceLayers={sourceLayers}
											configPath={'blueprintConfig'}
										/>
									</Route>
									<Route path={`${this.props.match.path}/variants`}>
										<ShowStyleVariantsSettings
											showStyleVariants={this.props.showStyleVariants}
											blueprintConfigManifest={this.props.blueprintConfigManifest}
											showStyleBase={showStyleBase}
											layerMappings={layerMappings}
											sourceLayers={sourceLayers}
										/>
									</Route>

									<Redirect to={`${this.props.match.path}/generic`} />
								</Switch>
							</ErrorBoundary>
						</div>
					</div>
				</div>
			)
		}

		render() {
			if (this.props.showStyleBase) {
				return this.renderEditForm(this.props.showStyleBase)
			} else {
				return <Spinner />
			}
		}
	}
)
