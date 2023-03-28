import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { OutputLayers, ShowStyleBase, SourceLayers } from '../../../lib/collections/ShowStyleBases'
import { ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import RundownLayoutEditor from './RundownLayoutEditor'
import { Studio, MappingsExt } from '../../../lib/collections/Studios'
import {
	BlueprintManifestType,
	ConfigManifestEntry,
	IShowStyleConfigPreset,
	ISourceLayer,
} from '@sofie-automation/blueprints-integration'
import { BlueprintConfigManifestSettings, SourceLayerDropdownOption } from './BlueprintConfigManifest'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { TriggeredActionsEditor } from './components/triggeredActions/TriggeredActionsEditor'
import { SourceLayerSettings } from './ShowStyle/SourceLayer'
import { OutputLayerSettings } from './ShowStyle/OutputLayer'
import { HotkeyLegendSettings } from './ShowStyle/HotkeyLegend'
import { ShowStyleVariantsSettings } from './ShowStyle/VariantSettings'
import { ShowStyleGenericProperties } from './ShowStyle/Generic'
import { Switch, Route, Redirect } from 'react-router-dom'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import {
	applyAndValidateOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Blueprints, ShowStyleBases, ShowStyleVariants, Studios } from '../../collections'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { literal } from '@sofie-automation/corelib/dist/lib'

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
	blueprintConfigPreset: IShowStyleConfigPreset | undefined
	sourceLayersLight: Array<SourceLayerDropdownOption> | undefined
	sourceLayers: SourceLayers
	outputLayers: OutputLayers
	layerMappings: { [studioId: string]: MappingsExt }
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

	const mappings: { [studioId: string]: MappingsExt } = {}
	for (const studio of compatibleStudios) {
		mappings[studio.name] = applyAndValidateOverrides(studio.mappingsWithOverrides).obj
	}

	const sourceLayers = showStyleBase ? applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj : {}
	const outputLayers = showStyleBase ? applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj : {}

	return {
		showStyleBase: showStyleBase,
		showStyleVariants: showStyleBase
			? ShowStyleVariants.find(
					{
						showStyleBaseId: showStyleBase._id,
					},
					{
						sort: {
							_rank: 1,
							_id: 1,
						},
					}
			  ).fetch()
			: [],
		compatibleStudios: compatibleStudios,
		blueprintConfigManifest: blueprint ? blueprint.showStyleConfigManifest || [] : [],
		blueprintConfigPreset:
			blueprint && blueprint.showStyleConfigPresets && showStyleBase?.blueprintConfigPresetId
				? blueprint.showStyleConfigPresets[showStyleBase.blueprintConfigPresetId]
				: undefined,
		sourceLayers,
		outputLayers,
		sourceLayersLight: sourceLayers
			? Object.values(sourceLayers)
					.filter((layer): layer is ISourceLayer => !!layer)
					.map((layer, i) =>
						literal<SourceLayerDropdownOption>({
							value: layer._id,
							name: layer.name,
							type: layer.type,
							i,
						})
					)
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

		private saveBlueprintConfigOverrides = (newOps: SomeObjectOverrideOp[]) => {
			if (this.props.showStyleBase) {
				ShowStyleBases.update(this.props.showStyleBase._id, {
					$set: {
						'blueprintConfigWithOverrides.overrides': newOps,
					},
				})
			}
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
										<TriggeredActionsEditor
											showStyleBaseId={showStyleBase._id}
											sourceLayers={this.props.sourceLayers}
											outputLayers={this.props.outputLayers}
										/>
									</Route>
									<Route path={`${this.props.match.path}/hotkey-labels`}>
										<HotkeyLegendSettings showStyleBase={showStyleBase} />
									</Route>

									{RundownLayoutsAPI.getSettingsManifest(t).map((region) => {
										return (
											<Route key={region._id} path={`${this.props.match.path}/layouts-${region._id}`}>
												<RundownLayoutEditor
													showStyleBaseId={showStyleBase._id}
													sourceLayers={this.props.sourceLayers}
													outputLayers={this.props.outputLayers}
													studios={this.props.compatibleStudios}
													customRegion={region}
												/>
											</Route>
										)
									})}

									<Route path={`${this.props.match.path}/blueprint-config`}>
										<BlueprintConfigManifestSettings
											configManifestId={unprotectString(showStyleBase._id)}
											manifest={this.props.blueprintConfigManifest}
											layerMappings={this.props.layerMappings}
											sourceLayers={this.props.sourceLayersLight}
											configObject={showStyleBase.blueprintConfigWithOverrides}
											saveOverrides={this.saveBlueprintConfigOverrides}
											alternateConfig={undefined}
										/>
									</Route>
									<Route path={`${this.props.match.path}/variants`}>
										<ShowStyleVariantsSettings
											showStyleVariants={this.props.showStyleVariants}
											blueprintConfigManifest={this.props.blueprintConfigManifest}
											blueprintConfigPreset={this.props.blueprintConfigPreset}
											showStyleBase={showStyleBase}
											layerMappings={this.props.layerMappings}
											sourceLayers={this.props.sourceLayersLight}
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

		render(): JSX.Element {
			if (this.props.showStyleBase) {
				return this.renderEditForm(this.props.showStyleBase)
			} else {
				return <Spinner />
			}
		}
	}
)
