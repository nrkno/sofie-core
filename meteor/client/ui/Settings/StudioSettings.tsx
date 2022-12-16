import * as React from 'react'
import { Studio, Studios, MappingsExt } from '../../../lib/collections/Studios'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { PeripheralDevice, PeripheralDevices, PeripheralDeviceType } from '../../../lib/collections/PeripheralDevices'

import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { ShowStyleVariants, ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import { ShowStyleBases, ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { BlueprintManifestType, ConfigManifestEntry } from '@sofie-automation/blueprints-integration'
import { BlueprintConfigManifestSettings } from './BlueprintConfigManifest'
import { Blueprints } from '../../../lib/collections/Blueprints'
import { MappingsManifest } from '@sofie-automation/corelib/dist/deviceConfig'
import { StudioRoutings } from './Studio/Routings'
import { StudioDevices } from './Studio/Devices'
import { StudioMappings } from './Studio/Mappings'
import { StudioPackageManagerSettings } from './Studio/PackageManager'
import { StudioGenericProperties } from './Studio/Generic'
import { Redirect, Route, Switch } from 'react-router-dom'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import {
	applyAndValidateOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyDeep } from 'type-fest'
import { ShowStyleBaseId, ShowStyleVariantId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

interface IStudioSettingsProps {
	match: {
		url: string
		path: string
		params: {
			studioId: StudioId
		}
	}
}
interface IStudioSettingsState {}
interface IStudioSettingsTrackedProps {
	studio?: Studio
	studioMappings: ReadonlyDeep<MappingsExt>
	studioDevices: Array<PeripheralDevice>
	availableShowStyleVariants: Array<{
		name: string
		value: ShowStyleVariantId
		showStyleVariant: ShowStyleVariant
	}>
	availableShowStyleBases: Array<{
		name: string
		value: ShowStyleBaseId
		showStyleBase: ShowStyleBase
	}>
	availableDevices: Array<PeripheralDevice>
	blueprintConfigManifest: ConfigManifestEntry[]
	layerMappingsManifest: MappingsManifest | undefined
}

export default translateWithTracker<IStudioSettingsProps, IStudioSettingsState, IStudioSettingsTrackedProps>(
	(props: IStudioSettingsProps) => {
		const studio = Studios.findOne(props.match.params.studioId)
		const blueprint = studio
			? Blueprints.findOne({
					_id: studio.blueprintId,
					blueprintType: BlueprintManifestType.STUDIO,
			  })
			: undefined

		return {
			studio: studio,
			studioMappings: studio ? applyAndValidateOverrides(studio.mappingsWithOverrides).obj : {},
			studioDevices: PeripheralDevices.find({
				studioId: props.match.params.studioId,
			}).fetch(),
			availableShowStyleVariants: ShowStyleVariants.find(
				studio
					? {
							showStyleBaseId: {
								$in: studio.supportedShowStyleBase || [],
							},
					  }
					: {}
			)
				.fetch()
				.map((variant) => {
					const baseStyle = ShowStyleBases.findOne(variant.showStyleBaseId)
					return {
						name: `${(baseStyle || { name: '' }).name}: ${variant.name} (${variant._id})`,
						value: variant._id,
						showStyleVariant: variant,
					}
				}),
			availableShowStyleBases: ShowStyleBases.find()
				.fetch()
				.map((showStyle) => {
					return {
						name: `${showStyle.name}`,
						value: showStyle._id,
						showStyleBase: showStyle,
					}
				}),
			availableDevices: PeripheralDevices.find(
				{
					studioId: {
						$not: {
							$eq: props.match.params.studioId,
						},
					},
					parentDeviceId: {
						$exists: false,
					},
				},
				{
					sort: {
						lastConnected: -1,
					},
				}
			).fetch(),
			blueprintConfigManifest: blueprint ? blueprint.studioConfigManifest || [] : [],
			// TODO - these should come from the device the mapping is targeting but for now this will catch 99% of expected use cases
			layerMappingsManifest: PeripheralDevices.findOne(
				{
					studioId: {
						$eq: props.match.params.studioId,
					},
					parentDeviceId: {
						$exists: false,
					},
					type: {
						$eq: PeripheralDeviceType.PLAYOUT,
					},
				},
				{
					sort: {
						lastConnected: -1,
					},
				}
			)?.configManifest?.layerMappings,
		}
	}
)(
	class StudioSettings extends MeteorReactComponent<
		Translated<IStudioSettingsProps & IStudioSettingsTrackedProps>,
		IStudioSettingsState
	> {
		getLayerMappingsFlat() {
			// TODO - this is too reactive
			const mappings = {}
			if (this.props.studio) {
				mappings[this.props.studio.name] = applyAndValidateOverrides(this.props.studio.mappingsWithOverrides).obj
			}
			return mappings
		}

		private saveBlueprintConfigOverrides = (newOps: SomeObjectOverrideOp[]) => {
			if (this.props.studio) {
				Studios.update(this.props.studio._id, {
					$set: {
						'blueprintConfigWithOverrides.overrides': newOps,
					},
				})
			}
		}

		render() {
			return this.props.studio ? (
				<div className="studio-edit mod mhl mvn">
					<div className="row">
						<div className="col c12 r1-c12">
							<ErrorBoundary>
								<Switch>
									<Route path={`${this.props.match.path}/generic`}>
										<StudioGenericProperties
											studio={this.props.studio}
											availableShowStyleBases={this.props.availableShowStyleBases}
										/>
									</Route>
									<Route path={`${this.props.match.path}/devices`}>
										<StudioDevices
											studio={this.props.studio}
											studioDevices={this.props.studioDevices}
											availableDevices={this.props.availableDevices}
										/>
									</Route>
									<Route path={`${this.props.match.path}/blueprint-config`}>
										<BlueprintConfigManifestSettings
											configManifestId={unprotectString(this.props.studio._id)}
											manifest={this.props.blueprintConfigManifest}
											layerMappings={this.getLayerMappingsFlat()}
											configObject={this.props.studio.blueprintConfigWithOverrides}
											saveOverrides={this.saveBlueprintConfigOverrides}
											alternateConfig={undefined}
										/>
									</Route>
									<Route path={`${this.props.match.path}/mappings`}>
										<StudioMappings studio={this.props.studio} manifest={this.props.layerMappingsManifest} />
									</Route>
									<Route path={`${this.props.match.path}/route-sets`}>
										<StudioRoutings
											studio={this.props.studio}
											studioMappings={this.props.studioMappings}
											manifest={this.props.layerMappingsManifest}
										/>
									</Route>
									<Route path={`${this.props.match.path}/package-manager`}>
										<StudioPackageManagerSettings studio={this.props.studio} />
									</Route>
									<Redirect to={`${this.props.match.path}/generic`} />
								</Switch>
							</ErrorBoundary>
						</div>
					</div>
				</div>
			) : (
				<Spinner />
			)
		}
	}
)

export function findHighestRank(array: Array<{ _rank: number } | undefined>): { _rank: number } | null {
	if (!array) return null
	let max: { _rank: number } | null = null

	array.forEach((value) => {
		if (value && (max === null || max._rank < value._rank)) {
			max = value
		}
	})

	return max
}
