import { addMigrationSteps } from './databaseMigration'
import { logger } from '../logging'
import { getRandomId, protectString, generateTranslation as t, getHash } from '../../lib/lib'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ShowStyleBases, ShowStyleVariants, Studios, TriggeredActions } from '../collections'
import {
	IBlueprintTriggeredActions,
	ClientActions,
	TriggerType,
	PlayoutActions,
} from '@sofie-automation/blueprints-integration'

/**
 * This file contains system specific migration steps.
 * These files are combined with / overridden by migration steps defined in the blueprints.
 */

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

// 0.1.0: These are the "base" migration steps, setting up a default system
export const addSteps = addMigrationSteps('0.1.0', [
	{
		id: 'studio exists',
		canBeRunAutomatically: true,
		validate: async () => {
			const count = await Studios.countDocuments()
			if (count === 0) return 'No Studio found'
			return false
		},
		migrate: async () => {
			// create default studio
			logger.info(`Migration: Add default studio`)
			await Studios.insertAsync({
				_id: protectString('studio0'),
				name: 'Default studio',
				organizationId: null,
				supportedShowStyleBase: [],
				settings: {
					frameRate: 25,
					mediaPreviewsUrl: '',
				},
				mappingsWithOverrides: wrapDefaultObject({}),
				blueprintConfigWithOverrides: wrapDefaultObject({}),
				_rundownVersionHash: '',
				routeSets: {},
				routeSetExclusivityGroups: {},
				packageContainers: {},
				thumbnailContainerIds: [],
				previewContainerIds: [],
				peripheralDeviceSettings: {
					playoutDevices: wrapDefaultObject({}),
					ingestDevices: wrapDefaultObject({}),
					inputDevices: wrapDefaultObject({}),
				},
				lastBlueprintConfig: undefined,
			})
		},
	},

	{
		// Create showStyleBase (migrate from studio)
		id: 'showStyleBase exists',
		canBeRunAutomatically: true,
		dependOnResultFrom: 'studio exists',
		validate: async () => {
			const count = await ShowStyleBases.countDocuments()
			if (count === 0) return 'No ShowStyleBase found'
			return false
		},
		migrate: async () => {
			// maybe copy from studio?
			const studios = await Studios.findFetchAsync({})
			if (studios.length === 1) {
				const studio = studios[0]

				const id = protectString('show0')
				await ShowStyleBases.insertAsync({
					_id: id,
					name: 'Default ShowStyle',
					organizationId: null,
					blueprintId: protectString(''),
					outputLayersWithOverrides: wrapDefaultObject({}),
					sourceLayersWithOverrides: wrapDefaultObject({}),
					hotkeyLegend: [],
					blueprintConfigWithOverrides: wrapDefaultObject({}),
					_rundownVersionHash: '',
					lastBlueprintConfig: undefined,
				})

				const variantId: ShowStyleVariantId = getRandomId()
				await ShowStyleVariants.insertAsync({
					_id: variantId,
					name: 'Default Variant',
					showStyleBaseId: id,
					blueprintConfigWithOverrides: wrapDefaultObject({}),
					_rundownVersionHash: '',
					_rank: 0,
				})

				if (!studio.supportedShowStyleBase || studio.supportedShowStyleBase.length === 0) {
					await Studios.updateAsync(studio._id, {
						$set: {
							supportedShowStyleBase: [id],
						},
					})
				}
			} else {
				// create default ShowStyleBase:
				logger.info(`Migration: Add default ShowStyleBase`)

				const id = protectString('show0')
				await ShowStyleBases.insertAsync({
					_id: id,
					name: 'Default ShowStyle',
					organizationId: null,
					blueprintId: protectString(''),
					outputLayersWithOverrides: wrapDefaultObject({}),
					sourceLayersWithOverrides: wrapDefaultObject({}),
					blueprintConfigWithOverrides: wrapDefaultObject({}),
					_rundownVersionHash: '',
					lastBlueprintConfig: undefined,
				})

				await ShowStyleVariants.insertAsync({
					_id: getRandomId(),
					name: 'Default Variant',
					showStyleBaseId: id,
					blueprintConfigWithOverrides: wrapDefaultObject({}),
					_rundownVersionHash: '',
					_rank: 0,
				})
			}
		},
	},
	{
		id: 'TriggeredActions.core',
		canBeRunAutomatically: true,
		validate: async () => {
			const coreTriggeredActionsCount = await TriggeredActions.countDocuments({
				showStyleBaseId: null,
			})

			if (coreTriggeredActionsCount === 0) {
				return `No system-wide triggered actions set up.`
			}

			return false
		},
		migrate: async () => {
			for (const triggeredAction of DEFAULT_CORE_TRIGGERS) {
				await TriggeredActions.insertAsync({
					_id: protectString(getHash(triggeredAction._id)),
					_rank: triggeredAction._rank,
					name: triggeredAction.name,
					blueprintUniqueId: null,
					showStyleBaseId: null,
					actionsWithOverrides: wrapDefaultObject(triggeredAction.actions),
					triggersWithOverrides: wrapDefaultObject(triggeredAction.triggers),
				})
			}
		},
	},
])
