import * as React from 'react'
import * as _ from 'underscore'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { AdLibPieceUi } from '../../AdLibPanel'
import { RundownUtils } from '../../../../lib/rundown'
import { Piece } from '../../../../../lib/collections/Pieces'
import { ConfigManifestEntry as BlueprintConfigManifestEntry, IConfigItem } from 'tv-automation-sofie-blueprints-integration'
import { MeteorReactComponent } from '../../../../lib/MeteorReactComponent'
import { translateWithTracker, Translated } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { AdLibAction } from '../../../../../lib/collections/AdLibActions'
import { createMongoCollection } from '../../../../../lib/collections/lib'
import { TransformedCollection } from '../../../../../lib/typings/meteor'
import { ConfigManifestEntryComponent } from '../../../Settings/components/ConfigManifestEntryComponent'
import { ConfigManifestEntry, ConfigManifestEntryType } from '../../../../../lib/api/deviceConfig'
import { Spinner } from '../../../../lib/Spinner'

export { isActionItem }

export interface IProps {
	piece: PieceUi | AdLibPieceUi
}

export interface ITrackedProps {
	targetAction: TransformedAdLibAction | undefined
}

export interface TransformedAdLibAction extends AdLibAction {
	transformedUserData: {
		[key: string]: any
	}
}

// create a temporary collection to store changes to the AdLib Actions
const ActionItems: TransformedCollection<TransformedAdLibAction, TransformedAdLibAction>
	= createMongoCollection<TransformedAdLibAction>(null as any)

export default translateWithTracker<IProps, {}, ITrackedProps>((props: IProps) => {
	let piece = RundownUtils.isAdLibPiece(props.piece) ?
		props.piece as AdLibPieceUi :
		props.piece.instance.piece as Piece

	let action = (piece as AdLibPieceUi).adlibAction

	return {
		targetAction: action ? ActionItems.findOne(action._id) : undefined
	}
})(class ActionItemRenderer extends MeteorReactComponent<Translated<IProps & ITrackedProps>> {
	componentDidMount() {
		const action = this.getActionItem()

		if (action) {
			ActionItems.insert({
				...action,
				transformedUserData: {
					...action.userData
				}
			})
		}
	}

	componentDidUpdate(prevProps: IProps & ITrackedProps) {
		const action = this.getActionItem()

		if (prevProps.targetAction && ((action && action._id !== prevProps.targetAction._id) || !action)) {
			ActionItems.remove(prevProps.targetAction._id)
		}

		if (action && prevProps.targetAction && prevProps.targetAction._id === action._id) {
			ActionItems.upsert(action._id, {
				$set: {
					actionId: action.actionId,
					partId: action.partId,
					rundownId: action.rundownId,
					display: {
						...action.display
					},
					userDataManifest: {
						...action.userDataManifest
					}
				}
			})
		} else if (action && prevProps.targetAction && prevProps.targetAction._id !== action._id) {
			ActionItems.insert({
				...action,
				transformedUserData: {
					...action.userData
				}
			})
		} else if (prevProps.targetAction) {
			ActionItems.remove(prevProps.targetAction._id)
		}
	}

	componentWillUnmount() {
		super.componentWillUnmount()

		if (this.props.targetAction) {
			ActionItems.remove(this.props.targetAction._id)
		}
	}

	getActionItem() {
		let piece = RundownUtils.isAdLibPiece(this.props.piece) ?
			this.props.piece as AdLibPieceUi :
			this.props.piece.instance.piece as Piece

		let action = (piece as AdLibPieceUi).adlibAction

		return action
	}

	renderConfigFields(configManifest: Array<ConfigManifestEntry | BlueprintConfigManifestEntry>, obj: any, prefix?: string) {
		const { t } = this.props

		return configManifest.length ?
			<div>
				{configManifest.map((configField) => (
					(configField.type === ConfigManifestEntryType.TABLE) ?
						null :
						<ConfigManifestEntryComponent key={configField.id} collection={ActionItems} configField={configField} obj={obj} prefix={prefix} className=''></ConfigManifestEntryComponent>
				))}
			</div> :
			<span>{t('AdLib does not provide any options')}</span>
	}

	render() {
		const { t } = this.props
		const action = this.getActionItem()

		if (!action) {
			return <Spinner />
		}

		return (
			<div className='shelf-inspector__action-editor'>
				<div className='shelf-inspector__action-editor__panel'>
					{(action.userDataManifest && action.userDataManifest.editableFields && this.props.targetAction &&
						<>{this.renderConfigFields(action.userDataManifest.editableFields, this.props.targetAction, 'transformedUserData.')}</>
						|| null
					)}
				</div>
				<div className='shelf-inspector__action-editor__actions'>
					<button>{t('Cue as Next')}</button>
					<button>{t('Save to Bucket')}</button>
					<button>{t('Reveal in List')}</button>
				</div>
			</div>
		)
	}
})

function isActionItem(item: AdLibPieceUi | PieceUi): boolean {
	const content = RundownUtils.isAdLibPiece(item) ?
		item as AdLibPieceUi :
		item.instance.piece as Piece

	if (content && (content as AdLibPieceUi).isAction) {
		return true
	}

	return false
}
