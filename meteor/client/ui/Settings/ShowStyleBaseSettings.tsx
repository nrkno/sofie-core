import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { Blueprints } from '../../../lib/collections/Blueprints'
import { ShowStyleBase, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { ShowStyleVariants, ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import RundownLayoutEditor from './RundownLayoutEditor'
import { Studio, Studios, MappingsExt } from '../../../lib/collections/Studios'
import {
	BlueprintManifestType,
	ConfigManifestEntry,
	ISourceLayer,
	SourceLayerType,
} from '@sofie-automation/blueprints-integration'
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
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'

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
	sourceLayers: Array<{ name: string; value: string; type: SourceLayerType }> | undefined
	layerMappings: { [key: string]: MappingsExt }
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

	const mappings: { [key: string]: MappingsExt } = {}
	for (const studio of compatibleStudios) {
		mappings[studio.name] = applyAndValidateOverrides(studio.mappingsWithOverrides).obj
	}

	return {
		showStyleBase: showStyleBase,
		showStyleVariants: showStyleBase
			? ShowStyleVariants.find({
					showStyleBaseId: showStyleBase._id,
			  }).fetch()
			: [],
		compatibleStudios: compatibleStudios,
		blueprintConfigManifest: blueprint ? blueprint.showStyleConfigManifest || [] : [],
		sourceLayers: showStyleBase
			? Object.values(applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj)
					.filter((layer): layer is ISourceLayer => !!layer)
					.map((layer) => {
						return {
							value: layer._id,
							name: layer.name,
							type: layer.type,
						}
					})
			: undefined,
		layerMappings: mappings,
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

		renderEditForm(showStyleBase: ShowStyleBase) {
			const { t } = this.props

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
											layerMappings={this.props.layerMappings}
											sourceLayers={this.props.sourceLayers}
											configPath={'blueprintConfigWithOverrides.defaults'}
										/>
									</Route>
									<Route path={`${this.props.match.path}/variants`}>
										<ShowStyleVariantsSettings
											showStyleVariants={this.props.showStyleVariants}
											blueprintConfigManifest={this.props.blueprintConfigManifest}
											showStyleBase={showStyleBase}
											layerMappings={this.props.layerMappings}
											sourceLayers={this.props.sourceLayers}
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
