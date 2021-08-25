import _ from 'underscore'
import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { ensureCollectionProperty } from './lib'
import { CustomizableRegions } from '../../lib/collections/RundownLayouts'
import { RundownPlaylist, RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { generateTranslation as t, objectPathGet, protectString } from '../../lib/lib'
import {
	ClientActions,
	IBlueprintTriggeredActions,
	PlaylistTimingType,
	PlayoutActions,
	TriggerType,
} from '@sofie-automation/blueprints-integration'
import { logger } from '../logging'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { TriggeredActions } from '../../lib/collections/TriggeredActions'

let j = 0

const DEFAULT_CORE_TRIGGERS: IBlueprintTriggeredActions[] = [
	{
		_id: 'core_toggleShelf',
		actions: [
			{
				action: ClientActions.shelf,
				filterChain: [
					{
						object: 'view',
					},
				],
				state: 'toggle',
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'Tab',
				up: true,
			},
		],
		_rank: ++j * 1000,
		name: t('Toggle Shelf'),
	},
	{
		_id: 'core_activateRundownPlaylist',
		actions: [
			{
				action: PlayoutActions.activateRundownPlaylist,
				rehearsal: false,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'Backslash',
				up: true,
			},
		],
		_rank: ++j * 1000,
		name: t('Activate (On-Air)'),
	},
	{
		_id: 'core_activateRundownPlaylist_rehearsal',
		actions: [
			{
				action: PlayoutActions.activateRundownPlaylist,
				rehearsal: true,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'Control+Backslash',
				up: true,
			},
		],
		_rank: ++j * 1000,
		name: t('Activate (Rehearsal)'),
	},
	{
		_id: 'core_deactivateRundownPlaylist',
		actions: [
			{
				action: PlayoutActions.deactivateRundownPlaylist,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'Control+Shift+Backslash',
				up: true,
			},
		],
		_rank: ++j * 1000,
		name: t('Deactivate'),
	},
	{
		_id: 'core_take',
		actions: [
			{
				action: PlayoutActions.take,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'NumpadEnter',
				up: true,
			},
			{
				type: TriggerType.hotkey,
				keys: 'F12',
				up: true,
			},
		],
		_rank: ++j * 1000,
		name: t('Take'),
	},
	{
		_id: 'core_hold',
		actions: [
			{
				action: PlayoutActions.hold,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'KeyH',
				up: true,
			},
		],
		_rank: ++j * 1000,
		name: t('Hold'),
	},
	{
		_id: 'core_hold_undo',
		actions: [
			{
				action: PlayoutActions.hold,
				undo: true,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'Shift+KeyH',
				up: true,
			},
		],
		_rank: ++j * 1000,
		name: t('Undo Hold'),
	},
	{
		_id: 'core_reset_rundown_playlist',
		actions: [
			{
				action: PlayoutActions.resetRundownPlaylist,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'Control+Shift+F12',
				up: true,
			},
			{
				type: TriggerType.hotkey,
				keys: 'Control+Shift+AnyEnter',
				up: true,
			},
		],
		_rank: ++j * 1000,
	},
	{
		_id: 'core_disable_next_piece',
		actions: [
			{
				action: PlayoutActions.disableNextPiece,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'KeyG',
				up: true,
			},
		],
		_rank: ++j * 1000,
	},
	{
		_id: 'core_disable_next_piece_undo',
		actions: [
			{
				action: PlayoutActions.disableNextPiece,
				filterChain: [
					{
						object: 'view',
					},
				],
				undo: true,
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'Shift+KeyG',
				up: true,
			},
		],
		_rank: ++j * 1000,
	},
	{
		_id: 'core_create_snapshot_for_debug',
		actions: [
			{
				action: PlayoutActions.createSnapshotForDebug,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'Backspace',
				up: true,
			},
		],
		_rank: ++j * 1000,
	},
	{
		_id: 'core_move_next_part',
		actions: [
			{
				action: PlayoutActions.moveNext,
				filterChain: [
					{
						object: 'view',
					},
				],
				parts: 1,
				segments: 0,
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'F9',
				up: true,
			},
		],
		_rank: ++j * 1000,
	},
	{
		_id: 'core_move_next_segment',
		actions: [
			{
				action: PlayoutActions.moveNext,
				filterChain: [
					{
						object: 'view',
					},
				],
				parts: 0,
				segments: 1,
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'F10',
				up: true,
			},
		],
		_rank: ++j * 1000,
	},
	{
		_id: 'core_move_previous_part',
		actions: [
			{
				action: PlayoutActions.moveNext,
				filterChain: [
					{
						object: 'view',
					},
				],
				parts: -1,
				segments: 0,
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'Shift+F9',
				up: true,
			},
		],
		_rank: ++j * 1000,
	},
	{
		_id: 'core_move_previous_segment',
		actions: [
			{
				action: PlayoutActions.moveNext,
				filterChain: [
					{
						object: 'view',
					},
				],
				parts: 0,
				segments: -1,
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'Shift+F10',
				up: true,
			},
		],
		_rank: ++j * 1000,
	},
	{
		_id: 'core_go_to_onAir_line',
		actions: [
			{
				action: ClientActions.goToOnAirLine,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'Control+Home',
				up: true,
			},
		],
		name: t('Go to On Air line'),
		_rank: ++j * 1000,
	},
	{
		_id: 'core_rewind_segments',
		actions: [
			{
				action: ClientActions.rewindSegments,
				filterChain: [
					{
						object: 'view',
					},
				],
			},
		],
		triggers: [
			{
				type: TriggerType.hotkey,
				keys: 'Shift+Home',
				up: true,
			},
		],
		name: t('Rewind segments to start'),
		_rank: ++j * 1000,
	},
]

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */
// Release X
export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
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
					...triggeredAction,
					_id: protectString(triggeredAction._id),
					showStyleBaseId: null,
					_rundownVersionHash: '',
				})
			})
		},
	},
	ensureCollectionProperty('RundownLayouts', { regionId: { $exists: false } }, 'regionId', CustomizableRegions.Shelf),
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
])
