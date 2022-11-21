import React from 'react'
import ClassNames from 'classnames'
import { faPencilAlt, faTrash, faCheck, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ConfigManifestEntry } from '@sofie-automation/blueprints-integration'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { withTranslation } from 'react-i18next'
import { MeteorCall } from '../../../../lib/api/methods'
import { ShowStyleBase } from '../../../../lib/collections/ShowStyleBases'
import { ShowStyleVariant, ShowStyleVariants } from '../../../../lib/collections/ShowStyleVariants'
import { EditAttribute } from '../../../lib/EditAttribute'
import { doModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { BlueprintConfigManifestSettings, SourceLayerDropdownOption } from '../BlueprintConfigManifest'
import {
	applyAndValidateOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface IShowStyleVariantsProps {
	showStyleBase: ShowStyleBase
	showStyleVariants: Array<ShowStyleVariant>
	blueprintConfigManifest: ConfigManifestEntry[]

	layerMappings?: { [studioId: string]: MappingsExt }
	sourceLayers?: Array<SourceLayerDropdownOption>
}
interface IShowStyleVariantsSettingsState {
	editedMappings: ProtectedString<any>[]
}
export const ShowStyleVariantsSettings = withTranslation()(
	class ShowStyleVariantsSettings extends React.Component<
		Translated<IShowStyleVariantsProps>,
		IShowStyleVariantsSettingsState
	> {
		constructor(props: Translated<IShowStyleVariantsProps>) {
			super(props)

			this.state = {
				editedMappings: [],
			}
		}
		isItemEdited = (layerId: ProtectedString<any>) => {
			return this.state.editedMappings.indexOf(layerId) >= 0
		}
		finishEditItem = (layerId: ProtectedString<any>) => {
			const index = this.state.editedMappings.indexOf(layerId)
			if (index >= 0) {
				this.state.editedMappings.splice(index, 1)
				this.setState({
					editedMappings: this.state.editedMappings,
				})
			}
		}
		editItem = (layerId: ProtectedString<any>) => {
			if (this.state.editedMappings.indexOf(layerId) < 0) {
				this.state.editedMappings.push(layerId)
				this.setState({
					editedMappings: this.state.editedMappings,
				})
			} else {
				this.finishEditItem(layerId)
			}
		}
		onAddShowStyleVariant = () => {
			MeteorCall.showstyles.insertShowStyleVariant(this.props.showStyleBase._id).catch(console.error)
		}
		confirmRemove = (showStyleVariant: ShowStyleVariant) => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this Variant?'),
				no: t('Cancel'),
				yes: t('Remove'),
				onAccept: () => {
					MeteorCall.showstyles.removeShowStyleVariant(showStyleVariant._id).catch(console.error)
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to remove the variant "{{showStyleVariantId}}"?', {
								showStyleVariantId: showStyleVariant.name,
							})}
						</p>
					</React.Fragment>
				),
			})
		}

		private saveBlueprintConfigOverrides = (variantId: ShowStyleVariantId, newOps: SomeObjectOverrideOp[]) => {
			ShowStyleVariants.update(variantId, {
				$set: {
					'blueprintConfigWithOverrides.overrides': newOps,
				},
			})
		}
		private pushBlueprintConfigOverride = (variantId: ShowStyleVariantId, newOp: SomeObjectOverrideOp) => {
			ShowStyleVariants.update(variantId, {
				$push: {
					'blueprintConfigWithOverrides.overrides': newOp,
				},
			})
		}

		renderShowStyleVariants() {
			const { t } = this.props

			return this.props.showStyleVariants.map((showStyleVariant) => {
				return (
					<React.Fragment key={unprotectString(showStyleVariant._id)}>
						<tr
							className={ClassNames({
								hl: this.isItemEdited(showStyleVariant._id),
							})}
						>
							<th className="settings-studio-showStyleVariant__name c3">
								{showStyleVariant.name || t('Unnamed variant')}
							</th>
							<td className="settings-studio-showStyleVariant__actions table-item-actions c3">
								<button className="action-btn" onClick={() => this.editItem(showStyleVariant._id)}>
									<FontAwesomeIcon icon={faPencilAlt} />
								</button>
								<button className="action-btn" onClick={() => this.confirmRemove(showStyleVariant)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>
						{this.isItemEdited(showStyleVariant._id) && (
							<tr className="expando-details hl">
								<td colSpan={5}>
									<div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Variant Name')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'name'}
													obj={showStyleVariant}
													type="text"
													collection={ShowStyleVariants}
													className="input text-input input-l"
												></EditAttribute>
											</label>
										</div>
									</div>
									<div className="row">
										<div className="col c12 r1-c12 phs">
											<BlueprintConfigManifestSettings
												configManifestId={unprotectString(showStyleVariant._id)}
												manifest={this.props.blueprintConfigManifest}
												alternateConfig={
													applyAndValidateOverrides(this.props.showStyleBase.blueprintConfigWithOverrides).obj
												}
												layerMappings={this.props.layerMappings}
												sourceLayers={this.props.sourceLayers}
												subPanel={true}
												configObject={showStyleVariant.blueprintConfigWithOverrides}
												saveOverrides={(newOps) => this.saveBlueprintConfigOverrides(showStyleVariant._id, newOps)}
												pushOverride={(newOp) => this.pushBlueprintConfigOverride(showStyleVariant._id, newOp)}
											/>
										</div>
									</div>
									<div className="mod alright">
										<button className="btn btn-primary" onClick={() => this.finishEditItem(showStyleVariant._id)}>
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

		render() {
			const { t } = this.props
			return (
				<div>
					<h2 className="mhn">{t('Variants')}</h2>
					<table className="table expando settings-studio-showStyleVariants-table">
						<tbody>{this.renderShowStyleVariants()}</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={this.onAddShowStyleVariant}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
				</div>
			)
		}
	}
)
