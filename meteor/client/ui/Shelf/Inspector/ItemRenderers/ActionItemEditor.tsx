import * as React from 'react'
import * as _ from 'underscore'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { AdLibPieceUi } from '../../AdLibPanel'
import { RundownUtils } from '../../../../lib/rundown'
import { Piece } from '../../../../../lib/collections/Pieces'
import { NoraContent, IConfigItem } from 'tv-automation-sofie-blueprints-integration'
import { ConfigManifestSettings } from '../../../Settings/ConfigManifestSettings'
import { MeteorReactComponent } from '../../../../lib/MeteorReactComponent'
import { translateWithTracker, Translated } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { AdLibAction } from '../../../../../lib/collections/AdLibActions'
import { createMongoCollection } from '../../../../../lib/collections/lib'
import { TransformedCollection } from '../../../../../lib/typings/meteor'

export { isActionItem }

export interface IProps {
	piece: PieceUi | AdLibPieceUi
}

export interface ITrackedProps {
	targetAction: TransformedAdLibAction | undefined
}

export interface TransformedAdLibAction extends AdLibAction {
	transformedUserData: Array<IConfigItem>
}

// create a temporary collection to store changes to the AdLib Actions
const ActionItems: TransformedCollection<TransformedAdLibAction, TransformedAdLibAction>
	= createMongoCollection<TransformedAdLibAction>(null as any)

export default translateWithTracker<IProps, {}, ITrackedProps>((props: IProps) => {
	let piece = RundownUtils.isAdLibPiece(this.props.piece) ?
		this.props.piece as AdLibPieceUi :
		this.props.piece.instance.piece as Piece

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
				transformedUserData: _.map(action.userData, (value, key) => ({
					_id: key,
					value
				}))
			})
		}
	}

	componentDidUpdate(prevProps: IProps & ITrackedProps) {
		const action = this.getActionItem()

		if (prevProps.targetAction && ((action && action._id !== prevProps.targetAction._id) || !action)) {
			ActionItems.remove(prevProps.targetAction._id)
		}

		if (action) {
			ActionItems.upsert(action._id, {
				...action,
				transformedUserData: _.map(action.userData, (value, key) => ({
					_id: key,
					value
				}))
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

	render() {
		const { t } = this.props
		const action = this.getActionItem()

		if (!action) {
			return (
				<span>{t('AdLib is an action, but it wasn\'t attached.')}</span>
			)
		}

		return (action.userDataManifest && action.userDataManifest.editableFields && this.props.targetAction &&
			<ConfigManifestSettings
				t={this.props.t}
				manifest={action.userDataManifest.editableFields}
				collection={ActionItems}
				configPath={'transformedUserData'}
				object={this.props.targetAction}
			/>) || <span>{t('AdLib does not provide any options')}</span>
	}
})

function isActionItem(item: AdLibPieceUi | PieceUi): boolean {
	const content = RundownUtils.isAdLibPiece(item) ?
		item as AdLibPieceUi :
		item.instance.piece as Piece

	if (content || (content as AdLibPieceUi).isAction) {
		return true
	}

	return false
}
