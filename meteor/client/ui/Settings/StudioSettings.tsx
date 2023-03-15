import React, { useCallback, useMemo } from 'react'
import { useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { PeripheralDeviceType } from '../../../lib/collections/PeripheralDevices'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { StudioRoutings } from './Studio/Routings'
import { StudioDevices } from './Studio/Devices'
import { StudioMappings } from './Studio/Mappings'
import { StudioPackageManagerSettings } from './Studio/PackageManager'
import { StudioGenericProperties } from './Studio/Generic'
import { Redirect, Route, Switch, useRouteMatch } from 'react-router-dom'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import {
	applyAndValidateOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Blueprints, PeripheralDevices, ShowStyleBases, Studios } from '../../collections'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { BlueprintConfigManifestSettings } from './BlueprintConfigManifest'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'

export default function StudioSettings(): JSX.Element {
	const match = useRouteMatch<{ studioId: string }>()
	const studioId = protectString(match.params.studioId)

	const studio = useTracker(() => Studios.findOne(studioId), [studioId])

	const studioMappings = useMemo(
		() => (studio ? applyAndValidateOverrides(studio.mappingsWithOverrides).obj : {}),
		[studio?.mappingsWithOverrides]
	)

	// TODO - move into child-component
	const availableShowStyleBases = useTracker(
		() =>
			ShowStyleBases.find()
				.fetch()
				.map((showStyle) => {
					return {
						name: `${showStyle.name}`,
						value: showStyle._id,
						showStyleBase: showStyle,
					}
				}),
		[],
		[]
	)

	const layerMappingsManifest = useTracker(() => {
		const peripheralDevice = PeripheralDevices.findOne(
			{
				studioId: {
					$eq: studioId,
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
		)

		return peripheralDevice?.configManifest?.layerMappings
	}, [studioId])

	return studio ? (
		<div className="studio-edit mod mhl mvn">
			<div className="row">
				<div className="col c12 r1-c12">
					<ErrorBoundary>
						<Switch>
							<Route path={`${match.path}/generic`}>
								<StudioGenericProperties studio={studio} availableShowStyleBases={availableShowStyleBases} />
							</Route>
							<Route path={`${match.path}/devices`}>
								<StudioDevices studioId={studio._id} />
							</Route>
							<Route path={`${match.path}/blueprint-config`}>
								<StudioBlueprintConfigManifest studio={studio} />
							</Route>
							<Route path={`${match.path}/mappings`}>
								<StudioMappings studio={studio} manifest={layerMappingsManifest} />
							</Route>
							<Route path={`${match.path}/route-sets`}>
								<StudioRoutings studio={studio} studioMappings={studioMappings} manifest={layerMappingsManifest} />
							</Route>
							<Route path={`${match.path}/package-manager`}>
								<StudioPackageManagerSettings studio={studio} />
							</Route>
							<Redirect to={`${match.path}/generic`} />
						</Switch>
					</ErrorBoundary>
				</div>
			</div>
		</div>
	) : (
		<Spinner />
	)
}

interface StudioBlueprintConfigManifestProps {
	studio: DBStudio
}
function StudioBlueprintConfigManifest({ studio }: StudioBlueprintConfigManifestProps) {
	const saveBlueprintConfigOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					'blueprintConfigWithOverrides.overrides': newOps,
				},
			})
		},
		[studio._id]
	)

	const blueprintConfigManifest = useTracker(
		() => {
			if (studio?.blueprintId) {
				const blueprint = Blueprints.findOne({
					_id: studio.blueprintId,
					blueprintType: BlueprintManifestType.STUDIO,
				})

				return blueprint ? blueprint.studioConfigManifest || [] : []
			} else {
				return []
			}
		},
		[studio?.blueprintId],
		[]
	)

	const layerMappingsFlat = useMemo(() => {
		const mappings = {}
		if (studio) {
			mappings[studio.name] = applyAndValidateOverrides(studio.mappingsWithOverrides).obj
		}
		return mappings
	}, [studio?.name, studio?.mappingsWithOverrides])

	return (
		<BlueprintConfigManifestSettings
			configManifestId={unprotectString(studio._id)}
			manifest={blueprintConfigManifest}
			layerMappings={layerMappingsFlat}
			configObject={studio.blueprintConfigWithOverrides}
			saveOverrides={saveBlueprintConfigOverrides}
			alternateConfig={undefined}
		/>
	)
}

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
