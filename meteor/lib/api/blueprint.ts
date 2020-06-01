import { BlueprintId } from '../collections/Blueprints'

export interface NewBlueprintAPI {
	insertBlueprint(): Promise<BlueprintId>
	removeBlueprint(blueprintId: BlueprintId): Promise<void>
	assignSystemBlueprint(blueprintId?: BlueprintId): Promise<void>
}

export enum BlueprintAPIMethods {
	'insertBlueprint' = 'showstyles.insertBlueprint',
	'removeBlueprint' = 'showstyles.removeBlueprint',
	'assignSystemBlueprint' = 'blueprint.assignSystem',
}
