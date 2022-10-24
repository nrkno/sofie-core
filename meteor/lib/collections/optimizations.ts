import { BlueprintId, ShowStyleBaseId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoQuery } from '../typings/meteor'
import { Blueprints, Blueprint } from './Blueprints'
import { DBShowStyleBase, ShowStyleBases } from './ShowStyleBases'
import { DBStudio, Studios, StudioLight } from './Studios'

export { StudioLight } from './Studios' // TODO: Legacy

/*
	This file contains various short-hand functions intended to be used for "light" fetches from collections.
	Like instead of fetching a full Blueprint or Studio it's enough to just fetch a small part of it.
	(Because this reduces the load and amount of data transferred)
*/

export async function fetchBlueprintLight(blueprintId: BlueprintId): Promise<BlueprintLight | undefined> {
	return Blueprints.findOneAsync(blueprintId, {
		fields: {
			code: 0,
		},
	})
}
export type BlueprintLight = Omit<Blueprint, 'code'>

/**
 * Returns a "light" version of the Studio, where the most heavy/large properties are omitted.
 */
export async function fetchStudioLight(studioId: StudioId): Promise<StudioLight | undefined> {
	return Studios.findOneAsync(studioId, {
		fields: {
			mappingsWithOverrides: 0,
			blueprintConfigWithOverrides: 0,
		},
	})
}

export async function fetchStudioIds(selector: MongoQuery<DBStudio>): Promise<StudioId[]> {
	const studios = await Studios.findFetchAsync(selector, {
		fields: {
			_id: 1,
		},
	})

	return studios.map((s) => s._id)
}

/** Checks if a studio exists */
export async function checkStudioExists(studioId: StudioId): Promise<boolean> {
	const studio = await Studios.findOneAsync(studioId, {
		fields: {
			_id: 1,
		},
	})

	return !!studio
}

/**
 * Returns a "light" version of the Studio, where the most heavy/large properties are omitted.
 */
export async function fetchShowStyleBaseLight(showStyleId: ShowStyleBaseId): Promise<ShowStyleBaseLight | undefined> {
	return ShowStyleBases.findOneAsync(showStyleId, {
		fields: {
			blueprintConfigWithOverrides: 0,
			outputLayersWithOverrides: 0,
			sourceLayersWithOverrides: 0,
		},
	})
}
export async function fetchShowStyleBasesLight(selector: MongoQuery<DBShowStyleBase>): Promise<ShowStyleBaseLight[]> {
	return ShowStyleBases.findFetchAsync(selector, {
		fields: {
			blueprintConfigWithOverrides: 0,
			outputLayersWithOverrides: 0,
			sourceLayersWithOverrides: 0,
		},
	})
}
export type ShowStyleBaseLight = Omit<
	DBShowStyleBase,
	'blueprintConfigWithOverrides' | 'outputLayersWithOverrides' | 'sourceLayersWithOverrides'
>
