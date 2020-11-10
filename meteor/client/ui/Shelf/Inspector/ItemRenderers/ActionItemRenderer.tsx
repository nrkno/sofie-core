import * as React from 'react'
import * as _ from 'underscore'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { AdLibPieceUi } from '../../AdLibPanel'
import { RundownUtils } from '../../../../lib/rundown'
import { Piece } from '../../../../../lib/collections/Pieces'
import { ConfigManifestEntry as BlueprintConfigManifestEntry } from 'tv-automation-sofie-blueprints-integration'
import { MeteorReactComponent } from '../../../../lib/MeteorReactComponent'
import { translateWithTracker, Translated } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { AdLibAction, AdLibActionCommon } from '../../../../../lib/collections/AdLibActions'
import { createMongoCollection } from '../../../../../lib/collections/lib'
import { TransformedCollection } from '../../../../../lib/typings/meteor'
import { ConfigManifestEntryComponent } from '../../../Settings/components/ConfigManifestEntryComponent'
import { ConfigManifestEntry, ConfigManifestEntryType } from '../../../../../lib/api/deviceConfig'
import { Spinner } from '../../../../lib/Spinner'
import { ShowStyleBase } from '../../../../../lib/collections/ShowStyleBases'
import InspectorTitle from './InspectorTitle'
import { RundownViewEvents } from '../../../RundownView'
import { RundownBaselineAdLibAction } from '../../../../../lib/collections/RundownBaselineAdLibActions'
import { ProtectedString } from '../../../../../lib/lib'
import { PartId } from '../../../../../lib/collections/Parts'
import { Studio } from '../../../../../lib/collections/Studios'

export { isActionItem }

export interface IProps {
	piece: PieceUi | AdLibPieceUi
	showStyleBase: ShowStyleBase
	studio: Studio
}

export interface ITrackedProps {
	targetAction: TransformedAdLibAction | undefined
}

export interface TransformedAdLibAction extends AdLibActionCommon {
	_id: ProtectedString<any>
	partId?: PartId | undefined
	transformedUserData: {
		[key: string]: any
	}
}

// create a temporary collection to store changes to the AdLib Actions
const LocalActionItems: TransformedCollection<TransformedAdLibAction, TransformedAdLibAction> = createMongoCollection<
	TransformedAdLibAction
>(null as any)

export default translateWithTracker<IProps, {}, ITrackedProps>((props: IProps) => {
	let piece = RundownUtils.isAdLibPiece(props.piece)
		? (props.piece as AdLibPieceUi)
		: (props.piece.instance.piece as Piece)

	let action = (piece as AdLibPieceUi).adlibAction

	return {
		targetAction: action ? LocalActionItems.findOne(action._id) : undefined,
	}
})(
	class ActionItemRenderer extends MeteorReactComponent<Translated<IProps & ITrackedProps>> {
		componentDidMount() {
			const action = this.getActionItem()

			if (action) {
				LocalActionItems.insert({
					...action,
					transformedUserData: {
						...action.userData,
					},
				})
			}
		}

		componentDidUpdate(prevProps: IProps & ITrackedProps) {
			const action = this.getActionItem()

			if (prevProps.targetAction && ((action && action._id !== prevProps.targetAction._id) || !action)) {
				LocalActionItems.remove(prevProps.targetAction._id)
			}

			if (action && prevProps.targetAction && prevProps.targetAction._id === action._id) {
				LocalActionItems.upsert(action._id, {
					$set: {
						actionId: action.actionId,
						partId: action.partId,
						rundownId: action.rundownId,
						display: {
							...action.display,
						},
						userDataManifest: {
							...action.userDataManifest,
						},
					},
				})
			} else if (action && prevProps.targetAction && prevProps.targetAction._id !== action._id) {
				LocalActionItems.insert({
					...action,
					transformedUserData: {
						...action.userData,
					},
				})
			} else if (prevProps.targetAction) {
				LocalActionItems.remove(prevProps.targetAction._id)
			}
		}

		componentWillUnmount() {
			super.componentWillUnmount()

			if (this.props.targetAction) {
				LocalActionItems.remove(this.props.targetAction._id)
			}
		}

		getActionItem() {
			let piece = RundownUtils.isAdLibPiece(this.props.piece)
				? (this.props.piece as AdLibPieceUi)
				: (this.props.piece.instance.piece as Piece)

			let action = (piece as AdLibPieceUi).adlibAction

			return action
		}

		renderConfigFields(
			configManifest: Array<ConfigManifestEntry | BlueprintConfigManifestEntry>,
			obj: any,
			prefix?: string
		) {
			const { t } = this.props

			return configManifest.length ? (
				<div>
					{configManifest.map((configField) =>
						configField.type === ConfigManifestEntryType.TABLE ? null : (
							<ConfigManifestEntryComponent
								key={configField.id}
								collection={LocalActionItems}
								configField={configField}
								obj={obj}
								prefix={prefix}
								className=""></ConfigManifestEntryComponent>
						)
					)}
				</div>
			) : (
				<span>{t('AdLib does not provide any options')}</span>
			)
		}

		onRevealSelectedItem = () => {
			let piece = RundownUtils.isAdLibPiece(this.props.piece)
				? (this.props.piece as AdLibPieceUi)
				: (this.props.piece.instance.piece as Piece)

			window.dispatchEvent(
				new CustomEvent(RundownViewEvents.revealInShelf, {
					detail: {
						pieceId: piece._id,
					},
				})
			)
		}

		onCueAsNext = (e: any) => {}

		onSaveToBucket = (e: any) => {}

		render() {
			const { t } = this.props
			const action = this.getActionItem()

			if (!action) {
				return <Spinner />
			}

			return (
				<>
					<InspectorTitle
						piece={this.props.piece}
						showStyleBase={this.props.showStyleBase}
						studio={this.props.studio}
					/>
					<div className="shelf-inspector__action-editor">
						<div className="shelf-inspector__action-editor__panel">
							{(action.userDataManifest && action.userDataManifest.editableFields && this.props.targetAction && (
								<>
									{this.renderConfigFields(
										action.userDataManifest.editableFields,
										this.props.targetAction,
										'transformedUserData.'
									)}
								</>
							)) ||
								null}
						</div>
						<div className="shelf-inspector__action-editor__actions">
							<button className="btn" onClick={this.onCueAsNext}>
								{t('Cue as Next')}
							</button>
							<button className="btn" onClick={this.onSaveToBucket}>
								{t('Save to Bucket')}
							</button>
							<button className="btn" onClick={this.onRevealSelectedItem}>
								{t('Reveal in Shelf')}
							</button>
						</div>
					</div>
				</>
			)
		}
	}
)

function isActionItem(item: AdLibPieceUi | PieceUi): boolean {
	const content = RundownUtils.isAdLibPiece(item) ? (item as AdLibPieceUi) : (item.instance.piece as Piece)

	if (content && (content as AdLibPieceUi).isAction) {
		return true
	}

	return false
}
