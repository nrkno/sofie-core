import { IBlueprintActionManifest, IBlueprintAdLibPiece } from '@sofie-automation/blueprints-integration'

export function isAdlibAction(
	adlib: IBlueprintActionManifest | IBlueprintAdLibPiece
): adlib is IBlueprintActionManifest {
	return !!(adlib as IBlueprintActionManifest).actionId
}
