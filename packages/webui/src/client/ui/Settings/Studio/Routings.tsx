import ClassNames from 'classnames'
import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import {
	DBStudio,
	StudioRouteSet,
	StudioRouteBehavior,
	RouteMapping,
	StudioRouteSetExclusivityGroup,
	StudioRouteType,
	MappingsExt,
	MappingExt,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { EditAttribute, EditAttributeBase } from '../../../lib/EditAttribute'
import { doModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPencilAlt, faCheck, faPlus } from '@fortawesome/free-solid-svg-icons'
import { withTranslation } from 'react-i18next'
import { TSR } from '@sofie-automation/blueprints-integration'
import { MeteorCall } from '../../../../lib/api/methods'
import { doUserAction, UserAction } from '../../../../lib/clientUserAction'
import { ReadonlyDeep } from 'type-fest'
import { MappingsSettingsManifest, MappingsSettingsManifests } from './Mappings'
import { SchemaFormForCollection } from '../../../lib/forms/SchemaFormForCollection'
import { literal, objectPathGet } from '@sofie-automation/corelib/dist/lib'
import { DropdownInputOption } from '../../../lib/Components/DropdownInput'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { Studios } from '../../../collections'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides'

interface IStudioRoutingsProps {
	translationNamespaces: string[]
	studio: DBStudio
	studioMappings: ReadonlyDeep<MappingsExt>
	manifest: MappingsSettingsManifests | undefined
}
interface IStudioRoutingsState {
	editedItems: Array<string>
}

export const StudioRoutings = withTranslation()(
	class StudioRoutings extends React.Component<Translated<IStudioRoutingsProps>, IStudioRoutingsState> {
		constructor(props: Translated<IStudioRoutingsProps>) {
			super(props)

			this.state = {
				editedItems: [],
			}
		}
		isItemEdited = (routeSetId: string) => {
			return this.state.editedItems.indexOf(routeSetId) >= 0
		}
		finishEditItem = (routeSetId: string) => {
			const index = this.state.editedItems.indexOf(routeSetId)
			if (index >= 0) {
				this.state.editedItems.splice(index, 1)
				this.setState({
					editedItems: this.state.editedItems,
				})
			}
		}
		editItem = (routeSetId: string) => {
			if (this.state.editedItems.indexOf(routeSetId) < 0) {
				this.state.editedItems.push(routeSetId)
				this.setState({
					editedItems: this.state.editedItems,
				})
			} else {
				this.finishEditItem(routeSetId)
			}
		}
		confirmRemoveEGroup = (eGroupId: string, exclusivityGroup: StudioRouteSetExclusivityGroup) => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this Exclusivity Group?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					this.removeExclusivityGroup(eGroupId)
				},
				message: (
					<React.Fragment>
						<p>
							{t(
								'Are you sure you want to remove exclusivity group "{{eGroupName}}"?\nRoute Sets assigned to this group will be reset to no group.',
								{
									eGroupName: exclusivityGroup.name,
								}
							)}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		}
		confirmRemoveRoute = (routeSetId: string, route: RouteMapping, index: number) => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this Route from this Route Set?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					this.removeRouteSetRoute(routeSetId, index)
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to remove the Route from "{{sourceLayerId}}" to "{{newLayerId}}"?', {
								sourceLayerId: route.mappedLayer,
								newLayerId: route.outputMappedLayer,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		}
		confirmRemove = (routeSetId: string) => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this Route Set?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					this.removeRouteSet(routeSetId)
				},
				message: (
					<React.Fragment>
						<p>{t('Are you sure you want to remove the Route Set "{{routeId}}"?', { routeId: routeSetId })}</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		}
		removeExclusivityGroup = (eGroupId: string) => {
			const unsetObject: Record<string, 1> = {}
			_.forEach(this.props.studio.routeSets, (routeSet, routeSetId) => {
				if (routeSet.exclusivityGroup === eGroupId) {
					unsetObject['routeSets.' + routeSetId + '.exclusivityGroup'] = 1
				}
			})
			unsetObject['routeSetExclusivityGroups.' + eGroupId] = 1
			Studios.update(this.props.studio._id, {
				$unset: unsetObject,
			})
		}
		removeRouteSetRoute = (routeId: string, index: number) => {
			const unsetObject: Record<string, any> = {}
			const newRoutes = this.props.studio.routeSets[routeId].routes.slice()
			newRoutes.splice(index, 1)
			unsetObject['routeSets.' + routeId + '.routes'] = newRoutes
			Studios.update(this.props.studio._id, {
				$set: unsetObject,
			})
		}
		removeRouteSet = (routeId: string) => {
			const unsetObject: Record<string, 1> = {}
			unsetObject['routeSets.' + routeId] = 1
			Studios.update(this.props.studio._id, {
				$unset: unsetObject,
			})
		}
		addNewRouteInSet = (routeId: string) => {
			const newRouteKeyName = 'newRouteSet'
			let iter = 0
			while ((this.props.studio.routeSets || {})[newRouteKeyName + iter]) {
				iter++
			}

			const newRoute: RouteMapping = {
				mappedLayer: '',
				outputMappedLayer: '',
				remapping: {},
				routeType: StudioRouteType.REROUTE,
			}
			const setObject: Record<string, any> = {}
			setObject['routeSets.' + routeId + '.routes'] = newRoute

			Studios.update(this.props.studio._id, {
				$push: setObject,
			})
		}
		addNewRouteSet = () => {
			// find free key name
			const newRouteKeyName = 'newRouteSet'
			let iter = 0
			while ((this.props.studio.routeSets || {})[newRouteKeyName + iter]) {
				iter++
			}

			const newRoute: StudioRouteSet = {
				name: 'New Route Set',
				active: false,
				routes: [],
				behavior: StudioRouteBehavior.TOGGLE,
			}
			const setObject: Record<string, any> = {}
			setObject['routeSets.' + newRouteKeyName + iter] = newRoute

			Studios.update(this.props.studio._id, {
				$set: setObject,
			})
		}
		addNewExclusivityGroup = () => {
			const newEGroupKeyName = 'exclusivityGroup'
			let iter = 0
			while ((this.props.studio.routeSetExclusivityGroups || {})[newEGroupKeyName + iter]) {
				iter++
			}

			const newGroup: StudioRouteSetExclusivityGroup = {
				name: 'New Exclusivity Group',
			}
			const setObject: Record<string, any> = {}
			setObject['routeSetExclusivityGroups.' + newEGroupKeyName + iter] = newGroup

			Studios.update(this.props.studio._id, {
				$set: setObject,
			})
		}
		updateRouteSetId = (edit: EditAttributeBase, newValue: string) => {
			const oldRouteId = edit.props.overrideDisplayValue
			const newRouteId = newValue + ''
			const route = this.props.studio.routeSets[oldRouteId]

			if (this.props.studio.routeSets[newRouteId]) {
				throw new Meteor.Error(400, 'Route Set "' + newRouteId + '" already exists')
			}

			const mSet: Record<string, any> = {}
			const mUnset: Record<string, 1> = {}
			mSet['routeSets.' + newRouteId] = route
			mUnset['routeSets.' + oldRouteId] = 1

			if (edit.props.collection) {
				edit.props.collection.update(this.props.studio._id, {
					$set: mSet,
					$unset: mUnset,
				})
			}

			this.finishEditItem(oldRouteId)
			this.editItem(newRouteId)
		}
		updateExclusivityGroupId = (edit: EditAttributeBase, newValue: string) => {
			const oldRouteId = edit.props.overrideDisplayValue
			const newRouteId = newValue + ''
			const route = this.props.studio.routeSetExclusivityGroups[oldRouteId]

			if (this.props.studio.routeSetExclusivityGroups[newRouteId]) {
				throw new Meteor.Error(400, 'Exclusivity Group "' + newRouteId + '" already exists')
			}

			const mSet: Record<string, any> = {}
			const mUnset: Record<string, 1> = {}
			mSet['routeSetExclusivityGroups.' + newRouteId] = route
			mUnset['routeSetExclusivityGroups.' + oldRouteId] = 1

			if (edit.props.collection) {
				edit.props.collection.update(this.props.studio._id, {
					$set: mSet,
					$unset: mUnset,
				})
			}

			this.finishEditItem(oldRouteId)
			this.editItem(newRouteId)
		}
		updateRouteSetActive = (routeSetId: string, value: boolean) => {
			const { t } = this.props
			doUserAction(t, 'StudioSettings', UserAction.SWITCH_ROUTE_SET, (e, ts) =>
				MeteorCall.userAction.switchRouteSet(e, ts, this.props.studio._id, routeSetId, value)
			)
		}

		renderRoutes(routeSet: StudioRouteSet, routeSetId: string, manifest: MappingsSettingsManifests) {
			const { t } = this.props

			return (
				<React.Fragment>
					<h4 className="mod mhs">{t('Routes')}</h4>
					{routeSet.routes.length === 0 ? (
						<p className="text-s dimmed field-hint mhs">{t('There are no routes set up yet')}</p>
					) : null}
					{routeSet.routes.map((route, index) => {
						const mappedLayer = route.mappedLayer ? this.props.studioMappings[route.mappedLayer] : undefined
						const deviceTypeFromMappedLayer: TSR.DeviceType | undefined = mappedLayer?.device

						const routeDeviceType: TSR.DeviceType | undefined =
							route.routeType === StudioRouteType.REMAP
								? route.deviceType
								: route.mappedLayer
								? deviceTypeFromMappedLayer
								: route.deviceType

						const routeMappingSchema = manifest[(routeDeviceType ?? route.remapping?.device) as TSR.DeviceType]

						const rawMappingTypeOptions = Object.entries<JSONSchema>(routeMappingSchema?.mappingsSchema || {})
						const mappingTypeOptions = rawMappingTypeOptions.map(([id, entry], i) =>
							literal<DropdownInputOption<string | number>>({
								value: id + '',
								name: entry?.title ?? id + '',
								i,
							})
						)

						return (
							<div className="route-sets-editor mod pan mas" key={index}>
								<button
									className="action-btn right mod man pas"
									onClick={() => this.confirmRemoveRoute(routeSetId, route, index)}
								>
									<FontAwesomeIcon icon={faTrash} />
								</button>
								<div className="properties-grid">
									<label className="field">
										<LabelActual label={t('Original Layer')} />
										<EditAttribute
											modifiedClassName="bghl"
											attribute={`routeSets.${routeSetId}.routes.${index}.mappedLayer`}
											obj={this.props.studio}
											type="dropdowntext"
											options={Object.keys(this.props.studioMappings)}
											label={t('None')}
											collection={Studios}
											className="input text-input input-l"
										></EditAttribute>
									</label>
									<label className="field">
										<LabelActual label={t('New Layer')} />
										<EditAttribute
											modifiedClassName="bghl"
											attribute={`routeSets.${routeSetId}.routes.${index}.outputMappedLayer`}
											obj={this.props.studio}
											type="text"
											collection={Studios}
											className="input text-input input-l"
										></EditAttribute>
									</label>

									<label className="field">
										<LabelActual label={t('Route Type')} />
										{!route.mappedLayer ? (
											<span className="mls">REMAP</span>
										) : (
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`routeSets.${routeSetId}.routes.${index}.routeType`}
												obj={this.props.studio}
												type="dropdown"
												options={StudioRouteType}
												optionsAreNumbers={true}
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
										)}
									</label>

									<label className="field">
										<LabelActual label={t('Device Type')} />
										{route.routeType === StudioRouteType.REROUTE && route.mappedLayer ? (
											deviceTypeFromMappedLayer !== undefined ? (
												<span className="mls">{TSR.DeviceType[deviceTypeFromMappedLayer]}</span>
											) : (
												<span className="mls dimmed">{t('Source Layer not found')}</span>
											)
										) : (
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`routeSets.${routeSetId}.routes.${index}.deviceType`}
												obj={this.props.studio}
												type="dropdown"
												options={TSR.DeviceType}
												optionsAreNumbers={true}
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
										)}
									</label>

									{mappingTypeOptions.length > 0 && (
										<label className="field">
											<LabelActual label={t('Mapping Type')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`routeSets.${routeSetId}.routes.${index}.remapping.options.mappingType`}
												obj={this.props.studio}
												type="dropdown"
												options={mappingTypeOptions}
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
										</label>
									)}
									{route.routeType === StudioRouteType.REMAP ||
									(routeDeviceType !== undefined && route.remapping !== undefined) ? (
										<>
											<label className="field">
												<LabelActual label={t('Device ID')} />
												<div>
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`routeSets.${routeSetId}.routes.${index}.remapping.deviceId`}
														obj={this.props.studio}
														type="checkbox"
														collection={Studios}
														className="mrs mvxs"
														mutateDisplayValue={(v) => (v === undefined ? false : true)}
														mutateUpdateValue={() => undefined}
													/>
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`routeSets.${routeSetId}.routes.${index}.remapping.deviceId`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
												</div>
											</label>

											<DeviceMappingSettings
												translationNamespaces={this.props.translationNamespaces}
												studio={this.props.studio}
												attribute={`routeSets.${routeSetId}.routes.${index}.remapping.options`}
												mappedLayer={mappedLayer}
												manifest={routeMappingSchema}
											/>
										</>
									) : null}
								</div>
							</div>
						)
					})}
				</React.Fragment>
			)
		}

		renderExclusivityGroups() {
			const { t } = this.props

			if (Object.keys(this.props.studio.routeSetExclusivityGroups).length === 0) {
				return (
					<tr>
						<td className="mhn dimmed">{t('There are no exclusivity groups set up.')}</td>
					</tr>
				)
			}

			return _.map(
				this.props.studio.routeSetExclusivityGroups,
				(exclusivityGroup: StudioRouteSetExclusivityGroup, exclusivityGroupId: string) => {
					return (
						<React.Fragment key={exclusivityGroupId}>
							<tr
								className={ClassNames({
									hl: this.isItemEdited(exclusivityGroupId),
								})}
							>
								<th className="settings-studio-device__name c3">{exclusivityGroupId}</th>
								<td className="settings-studio-device__id c5">{exclusivityGroup.name}</td>
								<td className="settings-studio-device__id c3">
									{
										_.filter(
											this.props.studio.routeSets,
											(routeSet) => routeSet.exclusivityGroup === exclusivityGroupId
										).length
									}
								</td>

								<td className="settings-studio-device__actions table-item-actions c3">
									<button className="action-btn" onClick={() => this.editItem(exclusivityGroupId)}>
										<FontAwesomeIcon icon={faPencilAlt} />
									</button>
									<button
										className="action-btn"
										onClick={() => this.confirmRemoveEGroup(exclusivityGroupId, exclusivityGroup)}
									>
										<FontAwesomeIcon icon={faTrash} />
									</button>
								</td>
							</tr>
							{this.isItemEdited(exclusivityGroupId) && (
								<tr className="expando-details hl">
									<td colSpan={6}>
										<div className="properties-grid">
											<label className="field">
												<LabelActual label={t('Exclusivity Group ID')} />
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'routeSetExclusivityGroups'}
													overrideDisplayValue={exclusivityGroupId}
													obj={this.props.studio}
													type="text"
													collection={Studios}
													updateFunction={this.updateExclusivityGroupId}
													className="input text-input input-l"
												></EditAttribute>
											</label>
											<label className="field">
												<LabelActual label={t('Exclusivity Group Name')} />
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'routeSetExclusivityGroups.' + exclusivityGroupId + '.name'}
													obj={this.props.studio}
													type="text"
													collection={Studios}
													className="input text-input input-l"
												></EditAttribute>
												<span className="text-s dimmed field-hint">{t('Display name of the Exclusivity Group')}</span>
											</label>
										</div>
										<div className="mod alright">
											<button className="btn btn-primary" onClick={() => this.finishEditItem(exclusivityGroupId)}>
												<FontAwesomeIcon icon={faCheck} />
											</button>
										</div>
									</td>
								</tr>
							)}
						</React.Fragment>
					)
				}
			)
		}

		renderRouteSets(manifest: MappingsSettingsManifests) {
			const { t } = this.props

			const DEFAULT_ACTIVE_OPTIONS = {
				[t('Active')]: true,
				[t('Not Active')]: false,
				[t('Not defined')]: undefined,
			}

			if (Object.keys(this.props.studio.routeSets).length === 0) {
				return (
					<tr>
						<td className="mhn dimmed">{t('There are no Route Sets set up.')}</td>
					</tr>
				)
			}

			return _.map(this.props.studio.routeSets, (routeSet: StudioRouteSet, routeId: string) => {
				return (
					<React.Fragment key={routeId}>
						<tr
							className={ClassNames({
								hl: this.isItemEdited(routeId),
							})}
						>
							<th className="settings-studio-device__name c2">{routeId}</th>
							<td className="settings-studio-device__id c3">{routeSet.name}</td>
							<td className="settings-studio-device__id c4">{routeSet.exclusivityGroup}</td>
							<td className="settings-studio-device__id c2">{routeSet.routes.length}</td>
							<td className="settings-studio-device__id c2">
								{routeSet.active ? <span className="pill">{t('Active')}</span> : null}
							</td>

							<td className="settings-studio-device__actions table-item-actions c3">
								<button className="action-btn" onClick={() => this.editItem(routeId)}>
									<FontAwesomeIcon icon={faPencilAlt} />
								</button>
								<button className="action-btn" onClick={() => this.confirmRemove(routeId)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>
						{this.isItemEdited(routeId) && (
							<tr className="expando-details hl">
								<td colSpan={6}>
									<div className="properties-grid">
										<label className="field">
											<LabelActual label={t('Route Set ID')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={'routeSets'}
												overrideDisplayValue={routeId}
												obj={this.props.studio}
												type="text"
												collection={Studios}
												updateFunction={this.updateRouteSetId}
												className="input text-input input-l"
											></EditAttribute>
										</label>
										<label className="field">
											<LabelActual label={t('Active')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`routeSets.${routeId}.active`}
												obj={this.props.studio}
												type="checkbox"
												collection={Studios}
												updateFunction={(_ctx, value) => this.updateRouteSetActive(routeId, value)}
												disabled={routeSet.behavior === StudioRouteBehavior.ACTIVATE_ONLY && routeSet.active}
												className=""
											></EditAttribute>
											<span className="mlm text-s dimmed field-hint">{t('Is this Route Set currently active')}</span>
										</label>
										<label className="field">
											<LabelActual label={t('Default State')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`routeSets.${routeId}.defaultActive`}
												obj={this.props.studio}
												type="dropdown"
												collection={Studios}
												options={DEFAULT_ACTIVE_OPTIONS}
												className="input text-input input-l"
											></EditAttribute>
											<span className="mlm text-s dimmed field-hint">{t('The default state of this Route Set')}</span>
										</label>

										<label className="field">
											<LabelActual label={t('Route Set Name')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`routeSets.${routeId}.name`}
												obj={this.props.studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">{t('Display name of the Route Set')}</span>
										</label>

										<label className="field">
											<LabelActual label={t('Exclusivity group')} />
											<div>
												<EditAttribute
													modifiedClassName="bghl"
													attribute={`routeSets.${routeId}.exclusivityGroup`}
													obj={this.props.studio}
													type="checkbox"
													className="mrs mvxs"
													collection={Studios}
													mutateDisplayValue={(v) => (v === undefined ? false : true)}
													mutateUpdateValue={() => undefined}
												/>
												<EditAttribute
													modifiedClassName="bghl"
													attribute={`routeSets.${routeId}.exclusivityGroup`}
													obj={this.props.studio}
													type="dropdown"
													options={Object.keys(this.props.studio.routeSetExclusivityGroups)}
													mutateDisplayValue={(v) => (v === undefined ? 'None' : v)}
													collection={Studios}
													className="input text-input input-l"
												></EditAttribute>
											</div>
											<span className="text-s dimmed field-hint">
												{t('If set, only one Route Set will be active per exclusivity group')}
											</span>
										</label>

										<label className="field">
											<LabelActual label={t('Behavior')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`routeSets.${routeId}.behavior`}
												obj={this.props.studio}
												type="dropdown"
												options={StudioRouteBehavior}
												optionsAreNumbers={true}
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">
												{t('The way this Route Set should behave towards the user')}
											</span>
										</label>
									</div>
									{this.renderRoutes(routeSet, routeId, manifest)}
									<div className="mod">
										<button className="btn btn-primary right" onClick={() => this.finishEditItem(routeId)}>
											<FontAwesomeIcon icon={faCheck} />
										</button>
										<button className="btn btn-secondary" onClick={() => this.addNewRouteInSet(routeId)}>
											<FontAwesomeIcon icon={faPlus} />
										</button>
									</div>
								</td>
							</tr>
						)}
					</React.Fragment>
				)
			})
		}

		render(): JSX.Element {
			const { t } = this.props
			return (
				<div>
					<h2 className="mhn mbs">{t('Route Sets')}</h2>
					{!this.props.manifest && (
						<span>{t('Add a playout device to the studio in order to configure the route sets')}</span>
					)}
					{this.props.manifest && (
						<React.Fragment>
							<p className="mhn mvs text-s dimmed field-hint">
								{t(
									'Controls for exposed Route Sets will be displayed to the producer within the Rundown View in the Switchboard.'
								)}
							</p>
							<h3 className="mhn">{t('Exclusivity Groups')}</h3>
							<table className="expando settings-studio-mappings-table">
								<tbody>{this.renderExclusivityGroups()}</tbody>
							</table>
							<div className="mod mhs">
								<button className="btn btn-primary" onClick={() => this.addNewExclusivityGroup()}>
									<FontAwesomeIcon icon={faPlus} />
								</button>
							</div>
							<h3 className="mhn">{t('Route Sets')}</h3>
							<table className="expando settings-studio-mappings-table">
								<tbody>{this.renderRouteSets(this.props.manifest)}</tbody>
							</table>
							<div className="mod mhs">
								<button className="btn btn-primary" onClick={() => this.addNewRouteSet()}>
									<FontAwesomeIcon icon={faPlus} />
								</button>
							</div>
						</React.Fragment>
					)}
				</div>
			)
		}
	}
)

interface IDeviceMappingSettingsProps {
	translationNamespaces: string[]
	studio: DBStudio
	attribute: string
	manifest: MappingsSettingsManifest | undefined
	mappedLayer: ReadonlyDeep<MappingExt> | undefined
}

function DeviceMappingSettings({
	translationNamespaces,
	attribute,
	manifest,
	studio,
	mappedLayer,
}: IDeviceMappingSettingsProps) {
	const routeRemapping = objectPathGet(studio, attribute)

	const mappingType = routeRemapping?.mappingType ?? mappedLayer?.options?.mappingType
	const mappingSchema = manifest?.mappingsSchema?.[mappingType]

	if (mappingSchema && routeRemapping) {
		return (
			<SchemaFormForCollection
				schema={mappingSchema}
				object={routeRemapping}
				basePath={attribute}
				translationNamespaces={translationNamespaces}
				collection={Studios}
				objectId={studio._id}
				partialOverridesForObject={mappedLayer}
			/>
		)
	} else {
		return null
	}
}
