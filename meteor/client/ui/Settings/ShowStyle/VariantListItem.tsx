import React, { useRef } from 'react'
import classNames from 'classnames'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { DragSourceMonitor, DropTargetMonitor, useDrag, useDrop } from 'react-dnd'
import { Identifier } from 'dnd-core'
import { ShowStyleVariant } from '../../../../lib/collections/ShowStyleVariants'
import { EditAttribute } from '../../../lib/EditAttribute'
import { BlueprintConfigManifestSettings, SourceLayerDropdownOption } from '../BlueprintConfigManifest'
import { ShowStyleDragDropTypes } from './DragDropTypesShowStyle'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faCheck,
	faCopy,
	faDownload,
	faExclamationTriangle,
	faPencilAlt,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import {
	applyAndValidateOverrides,
	ObjectWithOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useTranslation } from 'react-i18next'
import { ConfigManifestEntry, IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { iconDragHandle } from '../../RundownList/icons'
import { ShowStyleVariants } from '../../../collections'

interface DraggableVariant {
	id: ShowStyleVariantId
	rank: number
	type: ShowStyleDragDropTypes
}

interface DraggableDropResult {
	overId: ShowStyleVariantId
}

export const VariantListItem = ({
	showStyleVariant,
	onDragVariant,
	onDragEnd,
	onDragCancel,
	isEdited,

	blueprintConfigManifest,
	baseBlueprintConfigWithOverrides,
	blueprintPresetConfigOptions,
	layerMappings,
	sourceLayers,

	onDownload,
	onCopy,
	onEdit,
	onFinishEdit,
	onDelete,
	onSaveOverrides,
	onPushOverride,
}: {
	showStyleVariant: ShowStyleVariant
	onDragVariant: (draggingId: ShowStyleVariantId, hoverId: ShowStyleVariantId) => void
	onDragEnd: (draggedId: ShowStyleVariantId) => void
	onDragCancel: () => void
	isEdited: boolean
	blueprintConfigManifest: ConfigManifestEntry[]
	baseBlueprintConfigWithOverrides: ObjectWithOverrides<IBlueprintConfig>
	blueprintPresetConfigOptions: { name: string; value: string | null }[]
	layerMappings?: { [studioId: string]: MappingsExt }
	sourceLayers?: Array<SourceLayerDropdownOption>

	onDownload: (showStyleVariant: ShowStyleVariant) => void
	onCopy: (showStyleVariantId: ShowStyleVariant) => void
	onEdit: (showStyleVariantId: ShowStyleVariantId) => void
	onFinishEdit: (showStyleVariantId: ShowStyleVariantId) => void
	onDelete: (showStyleVariant: ShowStyleVariant) => void
	onSaveOverrides: (showStyleVariantId: ShowStyleVariantId, newOps: SomeObjectOverrideOp[]) => void
	onPushOverride: (showStyleVariantId: ShowStyleVariantId, newOp: SomeObjectOverrideOp) => void
}): JSX.Element => {
	const ref = useRef<HTMLTableRowElement>(null)
	const [{ handlerId }, drop] = useDrop<DraggableVariant, DraggableDropResult, { handlerId: Identifier | null }>({
		accept: ShowStyleDragDropTypes.VARIANT,
		collect: (monitor: DropTargetMonitor) => ({ handlerId: monitor.getHandlerId() }),
		hover(hoverVariant: DraggableVariant) {
			if (!ref.current) {
				return
			}
			onDragVariant(hoverVariant.id, showStyleVariant._id)
		},
		drop: (item) => {
			if (item.type === ShowStyleDragDropTypes.VARIANT) {
				return {
					overId: showStyleVariant._id,
				}
			}
		},
	})

	const [{ isDragging }, drag] = useDrag<DraggableVariant, DraggableDropResult, { isDragging: boolean }>({
		item: { type: ShowStyleDragDropTypes.VARIANT, id: showStyleVariant._id, rank: showStyleVariant._rank },
		collect: (monitor: DragSourceMonitor) => ({
			isDragging: monitor.isDragging(),
		}),
		end: (item, monitor) => {
			const result = monitor.getDropResult() as DraggableDropResult
			if (!item || !monitor.didDrop() || !result) {
				onDragCancel()
				return
			}
			onDragEnd(item.id)
		},
	})

	const opacity = isDragging ? 0.4 : 1

	drag(drop(ref))

	const { t } = useTranslation()

	return (
		<React.Fragment key={unprotectString(showStyleVariant._id)}>
			<tbody>
				<tr
					data-handler-id={handlerId}
					ref={ref}
					style={{ opacity }}
					className={classNames({
						hl: isEdited,
					})}
				>
					<th className="settings-studio-showStyleVariant__name c3">
						<span className="settings-studio-showStyleVariants-table__drag">{iconDragHandle()}</span>
						{showStyleVariant.name || t('Unnamed variant')}&nbsp;
						{(!showStyleVariant.blueprintConfigPresetId || showStyleVariant.blueprintConfigPresetIdUnlinked) && (
							<FontAwesomeIcon icon={faExclamationTriangle} />
						)}
					</th>
					<td className="settings-studio-showStyleVariant__actions table-item-actions c3">
						<button className="action-btn" onClick={() => onDownload(showStyleVariant)}>
							<FontAwesomeIcon icon={faDownload} />
						</button>
						<button className="action-btn" onClick={() => onCopy(showStyleVariant)}>
							<FontAwesomeIcon icon={faCopy} />
						</button>
						<button className="action-btn" onClick={() => onEdit(showStyleVariant._id)}>
							<FontAwesomeIcon icon={faPencilAlt} />
						</button>
						<button className="action-btn" onClick={() => onDelete(showStyleVariant)}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
					</td>
				</tr>
			</tbody>
			<tbody>
				{isEdited && (
					<tr className="expando-details hl">
						<td colSpan={5}>
							<div>
								<div className="mod mvs mhs">
									<label className="field">
										{t('Name')}
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
							<label className="field">
								{t('Blueprint config preset')}
								{!showStyleVariant.blueprintConfigPresetId && (
									<div className="error-notice inline">
										{t('Blueprint config preset not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
									</div>
								)}
								{showStyleVariant.blueprintConfigPresetIdUnlinked && showStyleVariant.blueprintConfigPresetId && (
									<div className="error-notice inline">
										{t('Blueprint config preset is missing')} <FontAwesomeIcon icon={faExclamationTriangle} />
									</div>
								)}
								<div className="mdi">
									<EditAttribute
										modifiedClassName="bghl"
										attribute="blueprintConfigPresetId"
										obj={showStyleVariant}
										type="dropdown"
										options={blueprintPresetConfigOptions}
										mutateDisplayValue={(v) => v || ''}
										mutateUpdateValue={(v) => (v === '' ? undefined : v)}
										collection={ShowStyleVariants}
										className="mdinput"
									/>
									<span className="mdfx"></span>
								</div>
							</label>
							<div className="row">
								<div className="col c12 r1-c12 phs">
									<BlueprintConfigManifestSettings
										configManifestId={unprotectString(showStyleVariant._id)}
										manifest={blueprintConfigManifest}
										alternateConfig={applyAndValidateOverrides(baseBlueprintConfigWithOverrides).obj}
										layerMappings={layerMappings}
										sourceLayers={sourceLayers}
										subPanel={true}
										configObject={showStyleVariant.blueprintConfigWithOverrides}
										saveOverrides={(newOps) => onSaveOverrides(showStyleVariant._id, newOps)}
										pushOverride={(newOp) => onPushOverride(showStyleVariant._id, newOp)}
									/>
								</div>
							</div>
							<div className="mod alright">
								<button className="btn btn-primary" onClick={() => onFinishEdit(showStyleVariant._id)}>
									<FontAwesomeIcon icon={faCheck} />
								</button>
							</div>
						</td>
					</tr>
				)}
			</tbody>
		</React.Fragment>
	)
}
