import _ from 'underscore'
import { addMigrationSteps } from './databaseMigration'
import { ensureCollectionProperty } from './lib'
import { CustomizableRegions } from '../../lib/collections/RundownLayouts'
import { generateTranslation as t, getHash, objectPathGet, protectString } from '../../lib/lib'
import {
	ClientActions,
	IBlueprintTriggeredActions,
	PlaylistTimingType,
	PlayoutActions,
	TriggerType,
} from '@sofie-automation/blueprints-integration'
import { logger } from '../logging'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Blueprints, RundownPlaylists, Rundowns, TriggeredActions } from '../collections'
import { RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'

// Release 37 (2021-12-09)

let j = 0

const DEFAULT_CORE_TRIGGERS: IBlueprintTriggeredActions[] = [
	{
		_id: 'core_toggleShelf',
		actions: {
			'0': {
				action: ClientActions.shelf,
				filterChain: [
					{
						object: 'view',
					},
				],
				state: 'toggle',
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Tab',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Toggle Shelf'),
	},
	{
		_id: 'core_activateRundownPlaylist',
		actions: {
			'0': {
				action: PlayoutActions.activateRundownPlaylist,
				rehearsal: false,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Backquote',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Activate (On-Air)'),
	},
	{
		_id: 'core_activateRundownPlaylist_rehearsal',
		actions: {
			'0': {
				action: PlayoutActions.activateRundownPlaylist,
				rehearsal: true,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Control+Backquote',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Activate (Rehearsal)'),
	},
	{
		_id: 'core_deactivateRundownPlaylist',
		actions: {
			'0': {
				action: PlayoutActions.deactivateRundownPlaylist,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Control+Shift+Backquote',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Deactivate'),
	},
	{
		_id: 'core_take',
		actions: {
			'0': {
				action: PlayoutActions.take,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'NumpadEnter',
				up: true,
			},
			'1': {
				type: TriggerType.hotkey,
				keys: 'F12',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Take'),
	},
	{
		_id: 'core_hold',
		actions: {
			'0': {
				action: PlayoutActions.hold,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'KeyH',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Hold'),
	},
	{
		_id: 'core_hold_undo',
		actions: {
			'0': {
				action: PlayoutActions.hold,
				undo: true,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Shift+KeyH',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Undo Hold'),
	},
	{
		_id: 'core_reset_rundown_playlist',
		actions: {
			'0': {
				action: PlayoutActions.resetRundownPlaylist,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Control+Shift+F12',
				up: true,
			},
			'1': {
				type: TriggerType.hotkey,
				keys: 'Control+Shift+AnyEnter',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Reset Rundown'),
	},
	{
		_id: 'core_disable_next_piece',
		actions: {
			'0': {
				action: PlayoutActions.disableNextPiece,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'KeyG',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Disable the next element'),
	},
	{
		_id: 'core_disable_next_piece_undo',
		actions: {
			'0': {
				action: PlayoutActions.disableNextPiece,
				filterChain: [
					{
						object: 'view',
					},
				],
				undo: true,
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Shift+KeyG',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Undo Disable the next element'),
	},
	{
		_id: 'core_create_snapshot_for_debug',
		actions: {
			'0': {
				action: PlayoutActions.createSnapshotForDebug,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Backspace',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Store Snapshot'),
	},
	{
		_id: 'core_move_next_part',
		actions: {
			'0': {
				action: PlayoutActions.moveNext,
				filterChain: [
					{
						object: 'view',
					},
				],
				parts: 1,
				segments: 0,
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'F9',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Move Next forwards'),
	},
	{
		_id: 'core_move_next_segment',
		actions: {
			'0': {
				action: PlayoutActions.moveNext,
				filterChain: [
					{
						object: 'view',
					},
				],
				parts: 0,
				segments: 1,
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'F10',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Move Next to the following segment'),
	},
	{
		_id: 'core_move_previous_part',
		actions: {
			'0': {
				action: PlayoutActions.moveNext,
				filterChain: [
					{
						object: 'view',
					},
				],
				parts: -1,
				segments: 0,
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Shift+F9',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Move Next backwards'),
	},
	{
		_id: 'core_move_previous_segment',
		actions: {
			'0': {
				action: PlayoutActions.moveNext,
				filterChain: [
					{
						object: 'view',
					},
				],
				parts: 0,
				segments: -1,
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Shift+F10',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Move Next to the previous segment'),
	},
	{
		_id: 'core_go_to_onAir_line',
		actions: {
			'0': {
				action: ClientActions.goToOnAirLine,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Control+Home',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Go to On Air line'),
	},
	{
		_id: 'core_rewind_segments',
		actions: {
			'0': {
				action: ClientActions.rewindSegments,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		},
		triggers: {
			'0': {
				type: TriggerType.hotkey,
				keys: 'Shift+Home',
				up: true,
			},
		},
		_rank: ++j * 1000,
		name: t('Rewind segments to start'),
	},
]

export const addSteps = addMigrationSteps('1.37.0', [
	// {
	// 	id: 'ShowStyleBase.sourceLayers.clearKeyboardHotkey',
	// 	canBeRunAutomatically: true,
	// 	validate: () => {
	// 		const outdatedShowStyleBases = ShowStyleBases.find(
	// 			{
	// 				sourceLayers: {
	// 					$elemMatch: {
	// 						clearKeyboardHotkey: {
	// 							$exists: true,
	// 						},
	// 					},
	// 				},
	// 			},
	// 			{
	// 				fields: {
	// 					name: 1,
	// 				},
	// 			}
	// 		).map((showStyleBase) => showStyleBase._id)

	// 		if (outdatedShowStyleBases.length > 0) {
	// 			return `Show Styles: ${outdatedShowStyleBases
	// 				.map((name) => `"${name}"`)
	// 				.join(', ')} need to have their Source Layers clearable settings migrated.`
	// 		}

	// 		return false
	// 	},
	// 	migrate: () => {
	// 		ShowStyleBases.find({
	// 			sourceLayers: {
	// 				$elemMatch: {
	// 					clearKeyboardHotkey: {
	// 						$exists: true,
	// 					},
	// 				},
	// 			},
	// 		}).forEach((showStyleBase) => {
	// 			ShowStyleBases.update(showStyleBase._id, {
	// 				$set: {
	// 					sourceLayers: showStyleBase.sourceLayers.map((sourceLayer) => {
	// 						sourceLayer.isClearable = !!sourceLayer['clearKeyboardHotkey']
	// 						delete sourceLayer['clearKeyboardHotkey']
	// 						delete sourceLayer['activateKeyboardHotkeys']
	// 						delete sourceLayer['assignHotkeysToGlobalAdlibs']
	// 						delete sourceLayer['activateStickyKeyboardHotkey']
	// 						return sourceLayer
	// 					}),
	// 				},
	// 			})
	// 		})
	// 	},
	// },
	{
		id: 'TriggeredActions.core',
		canBeRunAutomatically: true,
		validate: () => {
			const coreTriggeredActionsCount = TriggeredActions.find({
				showStyleBaseId: null,
			}).count()

			if (coreTriggeredActionsCount === 0) {
				return `No system-wide triggered actions set up.`
			}

			return false
		},
		migrate: () => {
			DEFAULT_CORE_TRIGGERS.forEach((triggeredAction) => {
				TriggeredActions.insert({
					_id: protectString(getHash(triggeredAction._id)),
					_rank: triggeredAction._rank,
					name: triggeredAction.name,
					blueprintUniqueId: null,
					showStyleBaseId: null,
					actionsWithOverrides: wrapDefaultObject(triggeredAction.actions),
					triggersWithOverrides: wrapDefaultObject(triggeredAction.triggers),
				})
			})
		},
	},
	ensureCollectionProperty(
		CollectionName.RundownLayouts,
		{ regionId: { $exists: false } },
		'regionId',
		CustomizableRegions.Shelf
	),
	{
		id: `RundownPlaylists.timing`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = RundownPlaylists.find({
				timing: {
					$exists: false,
				},
			}).fetch()
			let propertyMissing: string | boolean = false
			_.each(objects, (obj: any) => {
				const objValue = objectPathGet(obj, 'timing')
				if (!objValue) {
					propertyMissing = `timing is missing on ${obj._id}`
				}
			})
			// logger.info('')
			return propertyMissing
		},
		migrate: () => {
			const objects = RundownPlaylists.find({
				timing: {
					$exists: false,
				},
			}).fetch()
			_.each(objects, (obj: any) => {
				if (obj) {
					const m: Partial<RundownPlaylist> = {}
					m.timing = {
						type: PlaylistTimingType.ForwardTime,
						expectedStart: obj['expectedStart'],
						expectedDuration: obj['expectedDuration'],
					}
					logger.info(
						`Migration: Setting RundownPlaylists object "${obj._id}".timing to values from deprecated fields.`
					)
					RundownPlaylists.update(obj._id, { $set: m })
				}
			})
		},
	},
	{
		id: `Rundowns.timing`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = Rundowns.find({
				timing: {
					$exists: false,
				},
			}).fetch()
			let propertyMissing: string | boolean = false
			_.each(objects, (obj: any) => {
				const objValue = objectPathGet(obj, 'timing')
				if (!objValue) {
					propertyMissing = `timing is missing on ${obj._id}`
				}
			})
			// logger.info('')
			return propertyMissing
		},
		migrate: () => {
			const objects = Rundowns.find({
				timing: {
					$exists: false,
				},
			}).fetch()
			_.each(objects, (obj: any) => {
				if (obj) {
					const m: Partial<Rundown> = {}
					m.timing = {
						type: PlaylistTimingType.ForwardTime,
						expectedStart: obj['expectedStart'],
						expectedDuration: obj['expectedDuration'],
					}
					logger.info(
						`Migration: Setting Rundown object "${obj._id}".timing to values from deprecated fields.`
					)
					Rundowns.update(obj._id, { $set: m })
				}
			})
		},
	},
	{
		id: `Blueprints.hasCode`,
		canBeRunAutomatically: true,
		validate: () => {
			const count = Blueprints.find({
				hasCode: {
					$exists: false,
				},
			}).count()
			if (count > 0) return `${count} blueprints need to be updated`
			return false
		},
		migrate: () => {
			Blueprints.find({
				hasCode: {
					$exists: false,
				},
			}).forEach((bp) => {
				Blueprints.update(bp._id, {
					$set: {
						hasCode: !!bp.code,
					},
				})
			})
		},
	},
])
