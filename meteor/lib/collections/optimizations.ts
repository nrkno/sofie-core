import { MongoSelector } from '../typings/meteor'
import { BlueprintId, Blueprints, Blueprint } from './Blueprints'
import { DBShowStyleBase, ShowStyleBaseId, ShowStyleBases } from './ShowStyleBases'
import { DBStudio, StudioId, Studios, StudioLight } from './Studios'

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
			mappings: 0,
			blueprintConfig: 0,
		},
	})
}

export async function fetchStudioIds(selector: MongoSelector<DBStudio>): Promise<StudioId[]> {
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
			blueprintConfig: 0,
			outputLayers: 0,
			sourceLayers: 0,
		},
	})
}
export async function fetchShowStyleBasesLight(
	selector: MongoSelector<DBShowStyleBase>
): Promise<ShowStyleBaseLight[]> {
	return ShowStyleBases.findFetchAsync(selector, {
		fields: {
			blueprintConfig: 0,
			outputLayers: 0,
			sourceLayers: 0,
		},
	})
}
export type ShowStyleBaseLight = Omit<DBShowStyleBase, 'blueprintConfig' | 'outputLayers' | 'sourceLayers'>
