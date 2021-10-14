import { MongoSelector } from '../typings/meteor'
import { BlueprintId, Blueprints, Blueprint } from './Blueprints'
import { DBShowStyleBase, ShowStyleBaseId, ShowStyleBases } from './ShowStyleBases'
import { DBStudio, StudioId, Studios } from './Studios'

/*
	This file contains various short-hand functions intended to be used for "light" fetches from collections.
	Like instead of fetching a full Blueprint or Studio it's enough to just fetch a small part of it.
	(Because this reduces the load and amount of data transferred)
*/

export async function fetchBlueprintVersion(blueprintId: BlueprintId) {
	const blueprint = (await Blueprints.findOneAsync(blueprintId, { fields: { code: 0 } })) as Omit<Blueprint, 'code'>
	return blueprint?.blueprintVersion
}

/**
 * Returns a "light" version of the Studio, where the most heavy/large properties are omitted.
 */
export function fetchStudioLight(studioId: StudioId): StudioLight | undefined {
	const studio = Studios.findOne(studioId, {
		fields: {
			mappings: 0,
			blueprintConfig: 0,
		},
	})
	return studio
}
export function fetchStudiosLight(selector: MongoSelector<DBStudio>): StudioLight[] {
	return Studios.find(selector, {
		fields: {
			mappings: 0,
			blueprintConfig: 0,
		},
	}).fetch()
}
export type StudioLight = Omit<DBStudio, 'mappings' | 'blueprintConfig'>

/** Checks if a studio exists */
export function checkStudioExists(studioId: StudioId): boolean {
	const studio = Studios.findOne(studioId, {
		fields: {
			_id: 1,
		},
	})
	return !!studio
}

/**
 * Returns a "light" version of the Studio, where the most heavy/large properties are omitted.
 */
export function fetchShowStyleBaseLight(showStyleId: ShowStyleBaseId): ShowStyleBaseLight | undefined {
	const showStyle = ShowStyleBases.findOne(showStyleId, {
		fields: {
			blueprintConfig: 0,
			outputLayers: 0,
			sourceLayers: 0,
		},
	})
	return showStyle
}
export function fetchShowStyleBasesLight(selector: MongoSelector<DBShowStyleBase>): ShowStyleBaseLight[] {
	return ShowStyleBases.find(selector, {
		fields: {
			blueprintConfig: 0,
			outputLayers: 0,
			sourceLayers: 0,
		},
	}).fetch()
}
export type ShowStyleBaseLight = Omit<DBShowStyleBase, 'blueprintConfig' | 'outputLayers' | 'sourceLayers'>
