import React, { useCallback, useRef } from 'react'
import ClassNames from 'classnames'
import {
	faPencilAlt,
	faTrash,
	faCheck,
	faPlus,
	faDownload,
	faUpload,
	faCopy,
	faGripLines,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ConfigManifestEntry, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { withTranslation } from 'react-i18next'
import { MeteorCall } from '../../../../lib/api/methods'
import { ShowStyleBase } from '../../../../lib/collections/ShowStyleBases'
import { ShowStyleVariant, ShowStyleVariants } from '../../../../lib/collections/ShowStyleVariants'
import { EditAttribute } from '../../../lib/EditAttribute'
import { doModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { ConfigManifestSettings } from '../ConfigManifestSettings'
import { UploadButton } from '../../../lib/uploadButton'
import { DndProvider, DragSourceMonitor, DropTargetMonitor, useDrag, useDrop, XYCoord } from 'react-dnd'
import { Identifier } from 'dnd-core'
import { HTML5Backend } from 'react-dnd-html5-backend'
import update from 'immutability-helper'
import { ShowStyleDragDropTypes } from './DragDropTypesShowStyle'
import { NoticeLevel, Notification, NotificationCenter } from '../../../lib/notifications/notifications'
import { logger } from '../../../../lib/logging'
import { Meteor } from 'meteor/meteor'

interface IShowStyleVariantsProps {
	showStyleBase: ShowStyleBase
	showStyleVariants: ShowStyleVariant[]
	blueprintConfigManifest: ConfigManifestEntry[]

	layerMappings?: { [key: string]: MappingsExt }
	sourceLayers?: Array<{ name: string; value: string; type: SourceLayerType }>
}

interface IShowStyleVariantsSettingsState {
	editedMappings: ProtectedString<any>[]
	timestampedFileKey: number
	dndVariants: ShowStyleVariant[]
}

interface DraggableVariant {
	index: number
	type: ShowStyleDragDropTypes
}

const TIMEOUT_DELAY = 50

export const ShowStyleVariantsSettings = withTranslation()(
	class ShowStyleVariantsSettings extends React.Component<
		Translated<IShowStyleVariantsProps>,
		IShowStyleVariantsSettingsState
	> {
		private timeout?: number

		constructor(props: Translated<IShowStyleVariantsProps>) {
			super(props)

			this.state = {
				editedMappings: [],
				timestampedFileKey: Date.now(),
				dndVariants: this.props.showStyleVariants,
			}
		}

		componentDidUpdate(prevProps: Readonly<Translated<IShowStyleVariantsProps>>) {
			this.updateShowStyleVariants(prevProps.showStyleVariants)
		}

		private updateShowStyleVariants(prevShowStyleVariants: ShowStyleVariant[]) {
			if (!this.showStyleVariantsChanged(prevShowStyleVariants) && !this.noShowStyleVariantsPresentInState()) {
				return
			}

			if (this.timeout) {
				Meteor.clearTimeout(this.timeout)
			}
			this.timeout = Meteor.setTimeout(() => {
				this.setState({
					dndVariants: this.props.showStyleVariants,
				})
			}, TIMEOUT_DELAY)
		}

		componentWillUnmount() {
			if (this.timeout) {
				Meteor.clearTimeout(this.timeout)
			}
		}

		private showStyleVariantsChanged = (prevShowStyleVariants: ShowStyleVariant[]): boolean => {
			return prevShowStyleVariants !== this.props.showStyleVariants
		}

		private noShowStyleVariantsPresentInState = (): boolean => {
			return this.props.showStyleVariants.length > 0 && this.state.dndVariants.length === 0
		}

		private importShowStyleVariants = (event: React.ChangeEvent<HTMLInputElement>): void => {
			const { t } = this.props

			const file = event.target.files?.[0]
			if (!file) {
				return
			}

			const reader = new FileReader()

			reader.onload = () => {
				this.setState({
					timestampedFileKey: Date.now(),
				})

				const fileContents = reader.result as string

				const newShowStyleVariants: ShowStyleVariant[] = []
				try {
					JSON.parse(fileContents).map((showStyleVariant: ShowStyleVariant) =>
						newShowStyleVariants.push(showStyleVariant)
					)
					if (!Array.isArray(newShowStyleVariants)) {
						throw new Error('Imported file did not contain an array')
					}
				} catch (error) {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.WARNING,
							t('Failed to import new showstyle variants: {{errorMessage}}', { errorMessage: error + '' }),
							'VariantSettings'
						)
					)
					return
				}

				this.importShowStyleVariantsFromArray(newShowStyleVariants)
			}
			reader.readAsText(file)
		}

		private importShowStyleVariantsFromArray = (showStyleVariants: ShowStyleVariant[]): void => {
			const { t } = this.props
			showStyleVariants.forEach((showStyleVariant: ShowStyleVariant, index: number) => {
				const rank = this.state.dndVariants.length
				showStyleVariant._rank = rank + index
				MeteorCall.showstyles.importShowStyleVariant(showStyleVariant).catch(() => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.WARNING,
							t('Failed to import Variant {{name}}. Make sure it is not already imported.', {
								name: showStyleVariant.name,
							}),
							'VariantSettings'
						)
					)
				})
			})
		}

		private copyShowStyleVariant = (showStyleVariant: ShowStyleVariant): void => {
			showStyleVariant.name = `Copy of ${showStyleVariant.name}`
			showStyleVariant._rank = this.state.dndVariants.length
			MeteorCall.showstyles.importShowStyleVariantAsNew(showStyleVariant).catch(logger.warn)
		}

		private downloadShowStyleVariant = (showStyleVariant: ShowStyleVariant): void => {
			const showStyleVariants = [showStyleVariant]
			const jsonStr = JSON.stringify(showStyleVariants)
			const fileName = `${showStyleVariant.name}_showstyleVariant_${showStyleVariant._id}.json`
			this.download(jsonStr, fileName)
		}

		private downloadAllShowStyleVariants = (): void => {
			const jsonStr = JSON.stringify(this.state.dndVariants)
			const fileName = `All variants_${this.props.showStyleBase._id}.json`
			this.download(jsonStr, fileName)
		}

		private download = (jsonStr: string, fileName: string): void => {
			const element = document.createElement('a')
			element.href = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }))
			element.download = fileName

			element.click()
		}

		private isItemEdited = (layerId: ProtectedString<any>): boolean => {
			return this.state.editedMappings.indexOf(layerId) >= 0
		}

		private finishEditItem = (layerId: ProtectedString<any>): void => {
			const index = this.state.editedMappings.indexOf(layerId)
			if (index >= 0) {
				this.state.editedMappings.splice(index, 1)
				this.setState({
					editedMappings: this.state.editedMappings,
				})
			}
		}

		private editItem = (layerId: ProtectedString<any>): void => {
			if (this.state.editedMappings.indexOf(layerId) < 0) {
				this.state.editedMappings.push(layerId)
				this.setState({
					editedMappings: this.state.editedMappings,
				})
			} else {
				this.finishEditItem(layerId)
			}
		}

		private onAddShowStyleVariant = (): void => {
			MeteorCall.showstyles.createDefaultShowStyleVariant(this.props.showStyleBase._id).catch(logger.warn)
		}

		private confirmRemove = (showStyleVariant: ShowStyleVariant): void => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this Variant?'),
				no: t('Cancel'),
				yes: t('Remove'),
				onAccept: () => {
					MeteorCall.showstyles.removeShowStyleVariant(showStyleVariant._id).catch(logger.warn)
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

		private confirmRemoveAllShowStyleVariants = (): void => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove all variants?'),
				no: t('Cancel'),
				yes: t('Remove'),
				onAccept: () => {
					this.removeAllShowStyleVariants()
				},
				message: (
					<React.Fragment>
						<p>{t('Are you sure you want to remove all variants in the table?')}</p>
					</React.Fragment>
				),
			})
		}

		private removeAllShowStyleVariants = (): void => {
			this.state.dndVariants.forEach((variant: ShowStyleVariant) => {
				MeteorCall.showstyles.removeShowStyleVariant(variant._id).catch(logger.warn)
			})
		}

		private persistStateVariants = (): void => {
			MeteorCall.showstyles
				.reorderAllShowStyleVariants(this.props.showStyleBase._id, this.state.dndVariants)
				.catch(logger.warn)
		}

		VariantItem = ({ index, showStyleVariant, moveVariantHandler }) => {
			const ref = useRef<HTMLTableRowElement>(null)
			const [{ handlerId }, drop] = useDrop<DraggableVariant, void, { handlerId: Identifier | null }>({
				accept: ShowStyleDragDropTypes.VARIANT,
				collect: (monitor: DropTargetMonitor) => ({ handlerId: monitor.getHandlerId() }),
				hover(variant: DraggableVariant, monitor: DropTargetMonitor) {
					if (!ref.current) {
						return
					}
					const dragIndex = variant.index
					const hoverIndex = index

					if (dragIndex === hoverIndex) {
						return
					}

					const hoverBoundingRect = ref.current?.getBoundingClientRect()
					const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
					const clientOffset = monitor.getClientOffset()
					const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top

					if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
						return
					}

					if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
						return
					}

					moveVariantHandler(dragIndex, hoverIndex)
					variant.index = hoverIndex
				},
			})

			const [{ isDragging }, drag] = useDrag({
				item: { index, type: ShowStyleDragDropTypes.VARIANT },
				collect: (monitor: DragSourceMonitor) => ({
					isDragging: monitor.isDragging(),
				}),
				end: (_item, monitor) => {
					if (!monitor.didDrop()) {
						this.persistStateVariants()
					}
				},
			})

			const opacity = isDragging ? 0.4 : 1

			drag(drop(ref))

			const { t } = this.props

			return (
				<React.Fragment key={unprotectString(showStyleVariant._id)}>
					<tbody>
						<tr
							data-handler-id={handlerId}
							ref={ref}
							style={{ opacity }}
							className={ClassNames({
								hl: this.isItemEdited(showStyleVariant._id),
							})}
						>
							<th className="settings-studio-showStyleVariant__name c3">
								<span className="settings-studio-showStyleVariants-table__drag">
									<FontAwesomeIcon icon={faGripLines} />
								</span>
								{showStyleVariant.name || t('Unnamed variant')}
							</th>
							<td className="settings-studio-showStyleVariant__actions table-item-actions c3">
								<button className="action-btn" onClick={() => this.downloadShowStyleVariant(showStyleVariant)}>
									<FontAwesomeIcon icon={faDownload} />
								</button>
								<button className="action-btn" onClick={() => this.copyShowStyleVariant(showStyleVariant)}>
									<FontAwesomeIcon icon={faCopy} />
								</button>
								<button className="action-btn" onClick={() => this.editItem(showStyleVariant._id)}>
									<FontAwesomeIcon icon={faPencilAlt} />
								</button>
								<button className="action-btn" onClick={() => this.confirmRemove(showStyleVariant)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>
					</tbody>
					<tbody>
						{this.isItemEdited(showStyleVariant._id) && (
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
									<div className="row">
										<div className="col c12 r1-c12 phs">
											<ConfigManifestSettings
												t={this.props.t}
												i18n={this.props.i18n}
												tReady={this.props.tReady}
												manifest={this.props.blueprintConfigManifest}
												collection={ShowStyleVariants}
												configPath={'blueprintConfig'}
												alternateObject={this.props.showStyleBase}
												object={showStyleVariant}
												layerMappings={this.props.layerMappings}
												sourceLayers={this.props.sourceLayers}
												subPanel={true}
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
					</tbody>
				</React.Fragment>
			)
		}

		VariantList = ({ children, className }) => {
			const [, drop] = useDrop({
				accept: ShowStyleDragDropTypes.VARIANT,
				drop: () => this.persistStateVariants(),
				collect: (monitor: DropTargetMonitor) => ({
					isOver: monitor.isOver(),
					canDrop: monitor.canDrop(),
				}),
			})

			return (
				<table ref={drop} className={className}>
					{children}
				</table>
			)
		}

		VariantContainer = () => {
			const moveVariantHandler = useCallback((dragIndex: number, hoverIndex: number) => {
				const prevState = this.state.dndVariants
				this.setState({
					dndVariants: update(prevState, {
						$splice: [
							[dragIndex, 1],
							[hoverIndex, 0, prevState[dragIndex] as ShowStyleVariant],
						],
					}),
				})
			}, [])

			const returnVariantsForList = () => {
				return this.state.dndVariants.map((variant: ShowStyleVariant, index: number) => (
					<this.VariantItem
						key={unprotectString(variant._id)}
						index={index}
						showStyleVariant={variant}
						moveVariantHandler={moveVariantHandler}
					></this.VariantItem>
				))
			}

			const { t } = this.props
			return (
				<div>
					<h2 className="mhn">{t('Show Style Variants')}</h2>
					<DndProvider backend={HTML5Backend}>
						<div>
							<this.VariantList className="table expando settings-studio-showStyleVariants-table">
								{returnVariantsForList()}
							</this.VariantList>
						</div>
						<div className="mod mhs">
							<button className="btn btn-primary" onClick={this.onAddShowStyleVariant}>
								<FontAwesomeIcon icon={faPlus} />
							</button>
							<button className="btn btn-secondary mls" onClick={this.downloadAllShowStyleVariants}>
								<FontAwesomeIcon icon={faDownload} />
								&nbsp;{t('Export')}
							</button>
							<UploadButton
								className="btn btn-secondary mls"
								accept="application/json,.json"
								onChange={(event) => this.importShowStyleVariants(event)}
								key={this.state.timestampedFileKey}
							>
								<FontAwesomeIcon icon={faUpload} />
								&nbsp;{t('Import')}
							</UploadButton>
							<button className="btn btn-secondary right" onClick={this.confirmRemoveAllShowStyleVariants}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</div>
					</DndProvider>
				</div>
			)
		}

		render() {
			return <this.VariantContainer />
		}
	}
)
