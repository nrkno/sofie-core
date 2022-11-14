import { addMigrationSteps } from './databaseMigration'
import { DBStudio, MappingsExt, Studios } from '../../lib/collections/Studios'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { DBShowStyleVariant, ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { DBShowStyleBase, OutputLayers, ShowStyleBases, SourceLayers } from '../../lib/collections/ShowStyleBases'
import { DBBlueprintTrigger, TriggeredActions, TriggeredActionsObj } from '../../lib/collections/TriggeredActions'
import { getRandomString, normalizeArray } from '@sofie-automation/corelib/dist/lib'
import { IBlueprintConfig, IOutputLayer, ISourceLayer, SomeAction } from '@sofie-automation/blueprints-integration'

interface StudioOld {
	mappings: MappingsExt
	blueprintConfig: IBlueprintConfig
}
interface ShowStyleBaseOld {
	blueprintConfig: IBlueprintConfig
	outputLayers: IOutputLayer[]
	sourceLayers: ISourceLayer[]
}
interface ShowStyleVariantOld {
	blueprintConfig: IBlueprintConfig
}
interface TriggeredActionsOld {
	triggers: DBBlueprintTrigger[]
	actions: SomeAction[]
}

function normalizeArrayRandomId<T>(array: Array<T>): { [indexKey: string]: T } {
	const normalizedObject: any = {}
	for (const obj of array) {
		normalizedObject[obj[getRandomString()]] = obj
	}
	return normalizedObject as { [key: string]: T }
}

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

export const addSteps = addMigrationSteps('1.47.0', [
	// Add some migrations!
	{
		id: `Studios generate *withOverrides`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = Studios.find({
				$or: [
					{ blueprintConfigWithOverrides: { $exists: false } },
					{ mappingsWithOverrides: { $exists: false } },
				],
			}).count()
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = Studios.find({
				$or: [
					{ blueprintConfigWithOverrides: { $exists: false } },
					{ mappingsWithOverrides: { $exists: false } },
				],
			}).fetch()
			for (const obj0 of objects) {
				const obj = obj0 as unknown as DBStudio & StudioOld
				Studios.update(obj._id, {
					$set: {
						blueprintConfigWithOverrides:
							obj.blueprintConfigWithOverrides ??
							wrapDefaultObject<IBlueprintConfig>(obj.blueprintConfig),
						mappingsWithOverrides:
							obj.mappingsWithOverrides ?? wrapDefaultObject<MappingsExt>(obj.mappings),
					},
					$unset: {
						// TODO
						// objects: 1,
					},
				})
			}
		},
	},
	{
		id: `ShowStyleVariants generate *withOverrides`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = ShowStyleVariants.find({
				blueprintConfigWithOverrides: { $exists: false },
			}).count()
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = ShowStyleVariants.find({
				blueprintConfigWithOverrides: { $exists: false },
			}).fetch()
			for (const obj0 of objects) {
				const obj = obj0 as unknown as DBShowStyleVariant & ShowStyleVariantOld
				ShowStyleVariants.update(obj._id, {
					$set: {
						blueprintConfigWithOverrides:
							obj.blueprintConfigWithOverrides ??
							wrapDefaultObject<IBlueprintConfig>(obj.blueprintConfig),
					},
					$unset: {
						// TODO
						// objects: 1,
					},
				})
			}
		},
	},
	{
		id: `ShowStyleBases generate *withOverrides`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = ShowStyleBases.find({
				$or: [
					{ blueprintConfigWithOverrides: { $exists: false } },
					{ sourceLayersWithOverrides: { $exists: false } },
					{ outputLayersWithOverrides: { $exists: false } },
				],
			}).count()
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = ShowStyleBases.find({
				$or: [
					{ blueprintConfigWithOverrides: { $exists: false } },
					{ sourceLayersWithOverrides: { $exists: false } },
					{ outputLayersWithOverrides: { $exists: false } },
				],
			}).fetch()
			for (const obj0 of objects) {
				const obj = obj0 as unknown as DBShowStyleBase & ShowStyleBaseOld
				ShowStyleBases.update(obj._id, {
					$set: {
						blueprintConfigWithOverrides:
							obj.blueprintConfigWithOverrides ??
							wrapDefaultObject<IBlueprintConfig>(obj.blueprintConfig),
						sourceLayersWithOverrides:
							obj.sourceLayersWithOverrides ??
							wrapDefaultObject<SourceLayers>(normalizeArray(obj.sourceLayers, '_id')),
						outputLayersWithOverrides:
							obj.outputLayersWithOverrides ??
							wrapDefaultObject<OutputLayers>(normalizeArray(obj.outputLayers, '_id')),
					},
					$unset: {
						// TODO
						// objects: 1,
					},
				})
			}
		},
	},
	{
		id: `TriggeredActions generate *withOverrides`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = TriggeredActions.find({
				$or: [{ triggersWithOverrides: { $exists: false } }, { actionsWithOverrides: { $exists: false } }],
			}).count()
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = TriggeredActions.find({
				$or: [{ triggersWithOverrides: { $exists: false } }, { actionsWithOverrides: { $exists: false } }],
			}).fetch()
			for (const obj0 of objects) {
				const obj = obj0 as unknown as TriggeredActionsObj & TriggeredActionsOld

				TriggeredActions.update(obj._id, {
					$set: {
						triggersWithOverrides:
							obj.triggersWithOverrides ??
							wrapDefaultObject<Record<string, DBBlueprintTrigger>>(normalizeArrayRandomId(obj.triggers)),
						actionsWithOverrides:
							obj.actionsWithOverrides ??
							wrapDefaultObject<Record<string, SomeAction>>(normalizeArrayRandomId(obj.actions)),
					},
					$unset: {
						// TODO
						// objects: 1,
					},
				})
			}
		},
	},
])
