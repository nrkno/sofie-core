import { BlueprintId, Blueprints, Blueprint } from './Blueprints'
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
