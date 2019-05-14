import { Mongo } from 'meteor/mongo'
import { Meteor } from 'meteor/meteor'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { SourceLayerType } from 'tv-automation-sofie-blueprints-integration'

export enum RundownLayoutType {
	RUNDOWN_LAYOUT = 'rundown_layout',
	PUSHBUTTON_LAYOUT = 'pushbutton_layout'
}

export enum PieceDisplayStyle {
	LIST = 'list',
	BUTTONS = 'buttons'
}

export interface RundownLayoutFilter {
	name: string
	sourceLayerIds: string[] | undefined
	sourceLayerTypes: SourceLayerType[] | undefined
	outputLayerIds: string[] | undefined
	label: string[] | undefined
	displayStyle: PieceDisplayStyle
	currentSegment: boolean
	rundownBaseline: boolean | 'only'
}

export interface PushbuttonLayoutFilter extends RundownLayoutFilter {

}

export interface RundownLayoutBase {
	_id: string
	showStyleBaseId: string
	name: string
	type: RundownLayoutType
	filters: RundownLayoutFilter[]
}

export interface RundownLayout extends RundownLayoutBase {

}

export enum ActionButtonType {
	TAKE = 'take',
	HOLD = 'hold',
	MOVE_NEXT_PART = 'move_next_part',
	MOVE_NEXT_SEGMENT = 'move_next_segment',
	MOVE_PREVIOUS_PART = 'move_previous_part',
	MOVE_PREVIOUS_SEGMENT = 'move_previous_segment',
	ACTIVATE = 'activate',
	ACTIVATE_REHEARSAL = 'activate_rehearsal',
	DEACTIVATE = 'deactivate',
	RESET_RUNDOWN = 'reset_rundown'
}

export interface PushbuttonLayoutActionButton {
	type: ActionButtonType
}

export interface PushbuttonLayout extends RundownLayoutBase {
	// TODO: Interface to be defined later

	filters: PushbuttonLayoutFilter[]
	actionButtons: PushbuttonLayoutActionButton[]
}

export const RundownLayouts: TransformedCollection<RundownLayoutBase, RundownLayoutBase>
	= new Mongo.Collection<RundownLayoutBase>('rundownLayouts')
registerCollection('RundownLayouts', RundownLayouts)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RundownLayouts._ensureIndex({
			studioId: 1,
			collectionId: 1,
			objId: 1,
			mediaId: 1
		})
		RundownLayouts._ensureIndex({
			studioId: 1,
			mediaId: 1
		})
	}
})
