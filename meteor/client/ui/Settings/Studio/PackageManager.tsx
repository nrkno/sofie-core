import ClassNames from 'classnames'
import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { DBStudio, StudioPackageContainer } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { EditAttribute, EditAttributeBase } from '../../../lib/EditAttribute'
import { doModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPencilAlt, faCheck, faPlus } from '@fortawesome/free-solid-svg-icons'
import { withTranslation } from 'react-i18next'
import { Accessor } from '@sofie-automation/blueprints-integration'
import { Studios } from '../../../collections'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides'

interface IStudioPackageManagerSettingsProps {
	studio: DBStudio
}
interface IStudioPackageManagerSettingsState {
	editedPackageContainer: Array<string>
	editedAccessors: Array<string>
}

export const StudioPackageManagerSettings = withTranslation()(
	class StudioPackageManagerSettings extends React.Component<
		Translated<IStudioPackageManagerSettingsProps>,
		IStudioPackageManagerSettingsState
	> {
		constructor(props: Translated<IStudioPackageManagerSettingsProps>) {
			super(props)

			this.state = {
				editedPackageContainer: [],
				editedAccessors: [],
			}
		}
		isPackageContainerEdited = (containerId: string) => {
			return this.state.editedPackageContainer.indexOf(containerId) >= 0
		}
		finishEditPackageContainer = (containerId: string) => {
			const index = this.state.editedPackageContainer.indexOf(containerId)
			if (index >= 0) {
				this.state.editedPackageContainer.splice(index, 1)
				this.setState({
					editedPackageContainer: this.state.editedPackageContainer,
				})
			}
		}
		editPackageContainer = (containerId: string) => {
			if (this.state.editedPackageContainer.indexOf(containerId) < 0) {
				this.state.editedPackageContainer.push(containerId)
				this.setState({
					editedPackageContainer: this.state.editedPackageContainer,
				})
			} else {
				this.finishEditPackageContainer(containerId)
			}
		}
		confirmRemovePackageContainer = (containerId: string) => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this Package Container?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					this.removePackageContainer(containerId)
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to remove the Package Container "{{containerId}}"?', {
								containerId: containerId,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		}
		removePackageContainer = (containerId: string) => {
			const unsetObject: Record<string, 1> = {}
			unsetObject['packageContainers.' + containerId] = 1
			Studios.update(this.props.studio._id, {
				$unset: unsetObject,
			})
		}
		addNewPackageContainer = () => {
			// find free key name
			const newKeyName = 'newContainer'
			let iter = 0
			while ((this.props.studio.packageContainers || {})[newKeyName + iter]) {
				iter++
			}

			const newPackageContainer: StudioPackageContainer = {
				deviceIds: [],
				container: {
					label: 'New Package Container',
					accessors: {},
				},
			}
			const setObject: Record<string, any> = {}
			setObject['packageContainers.' + newKeyName + iter] = newPackageContainer

			Studios.update(this.props.studio._id, {
				$set: setObject,
			})
		}
		containerId = (edit: EditAttributeBase, newValue: string) => {
			const oldContainerId = edit.props.overrideDisplayValue
			const newContainerId = newValue + ''
			const packageContainer = this.props.studio.packageContainers[oldContainerId]

			if (this.props.studio.packageContainers[newContainerId]) {
				throw new Meteor.Error(400, 'PackageContainer "' + newContainerId + '" already exists')
			}

			const mSet: Record<string, any> = {}
			const mUnset: Record<string, 1> = {}
			mSet['packageContainers.' + newContainerId] = packageContainer
			mUnset['packageContainers.' + oldContainerId] = 1

			if (edit.props.collection) {
				edit.props.collection.update(this.props.studio._id, {
					$set: mSet,
					$unset: mUnset,
				})
			}

			this.finishEditPackageContainer(oldContainerId)
			this.editPackageContainer(newContainerId)
		}
		getPlayoutDeviceIds() {
			const deviceIds: {
				name: string
				value: string
			}[] = []

			const playoutDevices = applyAndValidateOverrides(this.props.studio.peripheralDeviceSettings.playoutDevices).obj

			for (const deviceId of Object.keys(playoutDevices)) {
				deviceIds.push({
					name: deviceId,
					value: deviceId,
				})
			}

			return deviceIds
		}
		renderPackageContainers() {
			const { t } = this.props

			if (Object.keys(this.props.studio.packageContainers).length === 0) {
				return (
					<tr>
						<td className="mhn dimmed">{t('There are no Package Containers set up.')}</td>
					</tr>
				)
			}

			return _.map(
				this.props.studio.packageContainers,
				(packageContainer: StudioPackageContainer, containerId: string) => {
					return (
						<React.Fragment key={containerId}>
							<tr
								className={ClassNames({
									hl: this.isPackageContainerEdited(containerId),
								})}
							>
								<th className="settings-studio-package-container__id c2">{containerId}</th>
								<td className="settings-studio-package-container__name c2">{packageContainer.container.label}</td>

								<td className="settings-studio-package-container__actions table-item-actions c3">
									<button className="action-btn" onClick={() => this.editPackageContainer(containerId)}>
										<FontAwesomeIcon icon={faPencilAlt} />
									</button>
									<button className="action-btn" onClick={() => this.confirmRemovePackageContainer(containerId)}>
										<FontAwesomeIcon icon={faTrash} />
									</button>
								</td>
							</tr>
							{this.isPackageContainerEdited(containerId) && (
								<tr className="expando-details hl">
									<td colSpan={6}>
										<div className="properties-grid">
											<label className="field">
												<LabelActual label={t('Package Container ID')} />
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'packageContainers'}
													overrideDisplayValue={containerId}
													obj={this.props.studio}
													type="text"
													collection={Studios}
													updateFunction={this.containerId}
													className="input text-input input-l"
												></EditAttribute>
											</label>

											<label className="field">
												<LabelActual label={t('Label')} />
												<EditAttribute
													modifiedClassName="bghl"
													attribute={`packageContainers.${containerId}.container.label`}
													obj={this.props.studio}
													type="text"
													collection={Studios}
													className="input text-input input-l"
												></EditAttribute>
												<span className="text-s dimmed field-hint">
													{t('Display name/label of the Package Container')}
												</span>
											</label>

											<label className="field">
												<LabelActual label={t('Playout devices which uses this package container')} />
												<EditAttribute
													attribute={`packageContainers.${containerId}.deviceIds`}
													obj={this.props.studio}
													options={this.getPlayoutDeviceIds()}
													label={t('Select playout devices')}
													type="multiselect"
													collection={Studios}
												></EditAttribute>
												<span className="text-s dimmed field-hint">
													{t('Select which playout devices are using this package container')}
												</span>
											</label>

											<div className="mdi"></div>
										</div>
										<div>
											<div className="settings-studio-accessors">
												<h3 className="mhn">{t('Accessors')}</h3>
												<table className="expando settings-studio-package-containers-accessors-table">
													<tbody>{this.renderAccessors(containerId, packageContainer)}</tbody>
												</table>
												<div className="mod mhs">
													<button className="btn btn-primary" onClick={() => this.addNewAccessor(containerId)}>
														<FontAwesomeIcon icon={faPlus} />
													</button>
												</div>
											</div>
										</div>
									</td>
								</tr>
							)}
						</React.Fragment>
					)
				}
			)
		}
		isAccessorEdited = (containerId: string, accessorId: string) => {
			return this.state.editedAccessors.indexOf(containerId + accessorId) >= 0
		}
		finishEditAccessor = (containerId: string, accessorId: string) => {
			const index = this.state.editedAccessors.indexOf(containerId + accessorId)
			if (index >= 0) {
				this.state.editedAccessors.splice(index, 1)
				this.setState({
					editedAccessors: this.state.editedAccessors,
				})
			}
		}
		editAccessor = (containerId: string, accessorId: string) => {
			if (this.state.editedAccessors.indexOf(containerId + accessorId) < 0) {
				this.state.editedAccessors.push(containerId + accessorId)
				this.setState({
					editedAccessors: this.state.editedAccessors,
				})
			} else {
				this.finishEditAccessor(containerId, accessorId)
			}
		}
		confirmRemoveAccessor = (containerId: string, accessorId: string) => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this Package Container Accessor?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					this.removeAccessor(containerId, accessorId)
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to remove the Package Container Accessor "{{accessorId}}"?', {
								accessorId: accessorId,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		}
		removeAccessor = (containerId: string, accessorId: string) => {
			const unsetObject: Record<string, 1> = {}
			unsetObject[`packageContainers.${containerId}.container.accessors.${accessorId}`] = 1
			Studios.update(this.props.studio._id, {
				$unset: unsetObject,
			})
		}
		addNewAccessor = (containerId: string) => {
			// find free key name
			const newKeyName = 'local'
			let iter = 0
			const packageContainer = this.props.studio.packageContainers[containerId]
			if (!packageContainer) throw new Error(`Can't add an accessor to nonexistant Package Container "${containerId}"`)

			while (packageContainer.container.accessors[newKeyName + iter]) {
				iter++
			}
			const accessorId = newKeyName + iter

			const newAccessor: Accessor.LocalFolder = {
				type: Accessor.AccessType.LOCAL_FOLDER,
				label: 'Local folder',
				allowRead: true,
				allowWrite: false,
				folderPath: '',
			}
			const setObject: Record<string, any> = {}
			setObject[`packageContainers.${containerId}.container.accessors.${accessorId}`] = newAccessor

			Studios.update(this.props.studio._id, {
				$set: setObject,
			})
		}
		updateAccessorId = (edit: EditAttributeBase, newValue: string) => {
			const oldAccessorId = edit.props.overrideDisplayValue
			const newAccessorId = newValue + ''
			const containerId = edit.props.attribute
			if (!containerId) throw new Error(`containerId not set`)
			const packageContainer = this.props.studio.packageContainers[containerId]
			if (!packageContainer) throw new Error(`Can't edit an accessor to nonexistant Package Container "${containerId}"`)

			const accessor = this.props.studio.packageContainers[containerId].container.accessors[oldAccessorId]

			if (this.props.studio.packageContainers[containerId].container.accessors[newAccessorId]) {
				throw new Meteor.Error(400, 'Accessor "' + newAccessorId + '" already exists')
			}

			const mSet: Record<string, any> = {}
			const mUnset: Record<string, 1> = {}
			mSet[`packageContainers.${containerId}.container.accessors.${newAccessorId}`] = accessor
			mUnset[`packageContainers.${containerId}.container.accessors.${oldAccessorId}`] = 1

			if (edit.props.collection) {
				edit.props.collection.update(this.props.studio._id, {
					$set: mSet,
					$unset: mUnset,
				})
			}

			this.finishEditAccessor(containerId, oldAccessorId)
			this.editAccessor(containerId, newAccessorId)
		}

		renderAccessors(containerId: string, packageContainer: StudioPackageContainer) {
			const { t } = this.props

			if (Object.keys(this.props.studio.packageContainers).length === 0) {
				return (
					<tr>
						<td className="mhn dimmed">{t('There are no Accessors set up.')}</td>
					</tr>
				)
			}

			return _.map(packageContainer.container.accessors, (accessor: Accessor.Any, accessorId: string) => {
				const accessorContent: string[] = []
				_.each(accessor as any, (value, key: string) => {
					if (key !== 'type' && value !== '') {
						let str = JSON.stringify(value)
						if (str.length > 20) str = str.slice(0, 17) + '...'
						accessorContent.push(`${key}: ${str}`)
					}
				})
				return (
					<React.Fragment key={accessorId}>
						<tr
							className={ClassNames({
								hl: this.isAccessorEdited(containerId, accessorId),
							})}
						>
							<th className="settings-studio-accessor__id c2">{accessorId}</th>
							{/* <td className="settings-studio-accessor__name c2">{accessor.name}</td> */}
							<td className="settings-studio-accessor__type c1">{accessor.type}</td>
							<td className="settings-studio-accessor__accessorContent c7">{accessorContent.join(', ')}</td>

							<td className="settings-studio-accessor__actions table-item-actions c3">
								<button className="action-btn" onClick={() => this.editAccessor(containerId, accessorId)}>
									<FontAwesomeIcon icon={faPencilAlt} />
								</button>
								<button className="action-btn" onClick={() => this.confirmRemoveAccessor(containerId, accessorId)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>
						{this.isAccessorEdited(containerId, accessorId) && (
							<tr className="expando-details hl">
								<td colSpan={6}>
									<div className="properties-grid">
										<label className="field">
											<LabelActual label={t('Accessor ID')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={containerId}
												overrideDisplayValue={accessorId}
												obj={this.props.studio}
												type="text"
												collection={Studios}
												updateFunction={this.updateAccessorId}
												className="input text-input input-l"
											></EditAttribute>
										</label>
										<label className="field">
											<LabelActual label={t('Label')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.label`}
												obj={this.props.studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
											<span className="text-s dimmed field-hint">{t('Display name of the Package Container')}</span>
										</label>
										<label className="field">
											<LabelActual label={t('Accessor Type')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.type`}
												obj={this.props.studio}
												type="dropdown"
												options={Accessor.AccessType}
												collection={Studios}
												className="input text-input input-l"
											></EditAttribute>
										</label>
										{accessor.type === Accessor.AccessType.LOCAL_FOLDER ? (
											<>
												<label className="field">
													<LabelActual label={t('Folder path')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.folderPath`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">
														{t('File path to the folder of the local folder')}
													</span>
												</label>

												<label className="field">
													<LabelActual label={t('Resource Id')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.resourceId`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">
														{t('(Optional) This could be the name of the computer on which the local folder is on')}
													</span>
												</label>
											</>
										) : accessor.type === Accessor.AccessType.HTTP ? (
											<>
												<label className="field">
													<LabelActual label={t('Base URL')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.baseUrl`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">
														{t('Base url to the resource (example: http://myserver/folder)')}
													</span>
												</label>
												<label className="field">
													<LabelActual label={t('Is Immutable')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.isImmutable`}
														obj={this.props.studio}
														type="checkbox"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">
														{t('When set, resources are considered immutable, ie they will not change')}
													</span>
												</label>
												<label className="field">
													<LabelActual label={t('Does NOT support HEAD requests')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.useGETinsteadOfHEAD`}
														obj={this.props.studio}
														type="checkbox"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">
														{t(
															"If set, Package Manager assumes that the source doesn't support HEAD requests and will use GET instead. If false, HEAD requests will be sent to check availability."
														)}
													</span>
												</label>

												<label className="field">
													<LabelActual label={t('Network Id')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.networkId`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">
														{t(
															'(Optional) A name/identifier of the local network where the share is located, leave empty if globally accessible'
														)}
													</span>
												</label>
											</>
										) : accessor.type === Accessor.AccessType.HTTP_PROXY ? (
											<>
												<label className="field">
													<LabelActual label={t('Base URL')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.baseUrl`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">
														{t('Base url to the resource (example: http://myserver/folder)')}
													</span>
												</label>

												<label className="field">
													<LabelActual label={t('Network Id')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.networkId`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">
														{t(
															'(Optional) A name/identifier of the local network where the share is located, leave empty if globally accessible'
														)}
													</span>
												</label>
											</>
										) : accessor.type === Accessor.AccessType.FILE_SHARE ? (
											<>
												<label className="field">
													<LabelActual label={t('Base URL')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.folderPath`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">{t('Folder path to shared folder')}</span>
												</label>
												<label className="field">
													<LabelActual label={t('UserName')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.userName`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">{t('Username for athuentication')}</span>
												</label>
												<label className="field">
													<LabelActual label={t('Password')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.password`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">{t('Password for authentication')}</span>
												</label>
												<label className="field">
													<LabelActual label={t('Network Id')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.networkId`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">
														{t('(Optional) A name/identifier of the local network where the share is located')}
													</span>
												</label>
											</>
										) : accessor.type === Accessor.AccessType.QUANTEL ? (
											<>
												<label className="field">
													<LabelActual label={t('Quantel gateway URL')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.quantelGatewayUrl`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">{t('URL to the Quantel Gateway')}</span>
												</label>
												<label className="field">
													<LabelActual label={t('ISA URLs')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.ISAUrls`}
														obj={this.props.studio}
														type="array"
														arrayType="string"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">
														{t('URLs to the ISAs, in order of importance (comma separated)')}
													</span>
												</label>
												<label className="field">
													<LabelActual label={t('Zone ID')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.zoneId`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">{t('Zone ID (default value: "default")')}</span>
												</label>
												<label className="field">
													<LabelActual label={t('Server ID')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.serverId`}
														obj={this.props.studio}
														type="int"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">
														{t(
															'Server ID. For sources, this should generally be omitted (or set to 0) so clip-searches are zone-wide. If set, clip-searches are limited to that server.'
														)}
													</span>
												</label>

												<label className="field">
													<LabelActual label={t('Quantel transformer URL')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.transformerURL`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">{t('URL to the Quantel HTTP transformer')}</span>
												</label>

												<label className="field">
													<LabelActual label={t('Quantel FileFlow URL')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.fileflowURL`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">{t('URL to the Quantel FileFlow Manager')}</span>
												</label>

												<label className="field">
													<LabelActual label={t('Quantel FileFlow Profile name')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.fileflowProfile`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"
													></EditAttribute>
													<span className="text-s dimmed field-hint">
														{t('Profile name to be used by FileFlow when exporting the clips')}
													</span>
												</label>
											</>
										) : null}

										<label className="field">
											<LabelActual label={t('Allow Read access')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.allowRead`}
												obj={this.props.studio}
												type="checkbox"
												collection={Studios}
												className="input"
											></EditAttribute>
											<span className="text-s dimmed field-hint">{t('')}</span>
										</label>

										<label className="field">
											<LabelActual label={t('Allow Write access')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`packageContainers.${containerId}.container.accessors.${accessorId}.allowWrite`}
												obj={this.props.studio}
												type="checkbox"
												collection={Studios}
												className="input"
											></EditAttribute>
											<span className="text-s dimmed field-hint">{t('')}</span>
										</label>
									</div>
									<div className="mod">
										<button
											className="btn btn-primary right"
											onClick={() => this.finishEditAccessor(containerId, accessorId)}
										>
											<FontAwesomeIcon icon={faCheck} />
										</button>
									</div>
								</td>
							</tr>
						)}
					</React.Fragment>
				)
			})
		}
		getAvailablePackageContainers() {
			const arr: {
				name: string
				value: string
			}[] = []

			for (const [containerId, packageContainer] of Object.entries<StudioPackageContainer>(
				this.props.studio.packageContainers
			)) {
				let hasHttpAccessor = false
				for (const accessor of Object.values<Accessor.Any>(packageContainer.container.accessors)) {
					if (accessor.type === Accessor.AccessType.HTTP_PROXY) {
						hasHttpAccessor = true
						break
					}
				}
				if (hasHttpAccessor) {
					arr.push({
						name: packageContainer.container.label,
						value: containerId,
					})
				}
			}
			return arr
		}

		render(): JSX.Element {
			const { t } = this.props
			return (
				<div>
					<h2 className="mhn mbs">{t('Package Manager')}</h2>

					<div className="settings-studio-package-containers">
						<h3 className="mhn">{t('Studio Settings')}</h3>

						<div>
							<div className="field mvs">
								<label>{t('Package Containers to use for previews')}</label>
								<div className="mdi">
									<EditAttribute
										attribute="previewContainerIds"
										obj={this.props.studio}
										options={this.getAvailablePackageContainers()}
										label={t('Click to show available Package Containers')}
										type="multiselect"
										collection={Studios}
									></EditAttribute>
								</div>
							</div>
							<div className="field mvs">
								<label>{t('Package Containers to use for thumbnails')}</label>
								<div className="mdi">
									<EditAttribute
										attribute="thumbnailContainerIds"
										obj={this.props.studio}
										options={this.getAvailablePackageContainers()}
										label={t('Click to show available Package Containers')}
										type="multiselect"
										collection={Studios}
									></EditAttribute>
								</div>
							</div>
						</div>

						<h3 className="mhn">{t('Package Containers')}</h3>
						<table className="table expando settings-studio-package-containers-table">
							<tbody>{this.renderPackageContainers()}</tbody>
						</table>
						<div className="mod mhs">
							<button className="btn btn-primary" onClick={() => this.addNewPackageContainer()}>
								<FontAwesomeIcon icon={faPlus} />
							</button>
						</div>
					</div>
				</div>
			)
		}
	}
)
