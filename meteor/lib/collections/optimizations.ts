import { MongoSelector } from '../typings/meteor'
import { BlueprintId, Blueprints, Blueprint } from './Blueprints'
import { ShowStyleBase, ShowStyleBaseId, ShowStyleBases } from './ShowStyleBases'
import { Studio, StudioId, Studios } from './Studios'

/*
	This file contains various short-hand functions intended to be used for "light" fetches from collections.
	Like instead of fetching a full Blueprint or Studio it's enough to just fetch a small part of it.
	(Because this reduces the load and amount of data transferred)
*/

export async function fetchBlueprintVersion(blueprintId: BlueprintId) {
	const blueprint = await fetchBlueprintLight(blueprintId)
	return blueprint?.blueprintVersion
}
export async function fetchBlueprintLight(blueprintId: BlueprintId): Promise<BlueprintLight | undefined> {
	return Blueprints.findOneAsync(blueprintId, {
		fields: {
			code: 0,
		},
	})
}
export async function fetchBlueprintsLight(selector: MongoSelector<Blueprint>): Promise<BlueprintLight[]> {
	return Blueprints.findFetchAsync(selector, {
		fields: {
			code: 0,
		},
	})
}
export type BlueprintLight = Omit<Blueprint, 'code'>

/**
 * Returns a "light" version of the Studio, where the most heavy/large properties are omitted.
 */
export function fetchStudioLight(studioId: StudioId): StudioLight | undefined {
	return Studios.findOne(studioId, {
		fields: {
			mappings: 0,
			blueprintConfig: 0,
		},
	})
}
export function fetchStudiosLight(selector: MongoSelector<Studio>): StudioLight[] {
	return Studios.find(selector, {
		fields: {
			mappings: 0,
			blueprintConfig: 0,
		},
	}).fetch()
}
export type StudioLight = Omit<Studio, 'mappings' | 'blueprintConfig'>

export function fetchStudioIds(selector: MongoSelector<Studio>): StudioId[] {
	return Studios.find(selector, {
		fields: {
			_id: 1,
		},
	})
		.fetch()
		.map((s) => s._id)
}

/** Checks if a studio exists */
export function checkStudioExists(studioId: StudioId): boolean {
	return !!Studios.findOne(studioId, {
		fields: {
			_id: 1,
		},
	})
}

/**
 * Returns a "light" version of the Studio, where the most heavy/large properties are omitted.
 */
export function fetchShowStyleBaseLight(showStyleId: ShowStyleBaseId): ShowStyleBaseLight | undefined {
	return ShowStyleBases.findOne(showStyleId, {
		fields: {
			blueprintConfig: 0,
			outputLayers: 0,
			sourceLayers: 0,
		},
	})
}
export function fetchShowStyleBasesLight(selector: MongoSelector<ShowStyleBase>): ShowStyleBaseLight[] {
	return ShowStyleBases.find(selector, {
		fields: {
			blueprintConfig: 0,
			outputLayers: 0,
			sourceLayers: 0,
		},
	}).fetch()
}
export type ShowStyleBaseLight = Omit<ShowStyleBase, 'blueprintConfig' | 'outputLayers' | 'sourceLayers'>
