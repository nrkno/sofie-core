import { IBlueprintActionManifest } from '@sofie-automation/blueprints-integration'
import { ArrayElement } from '../lib'
import { ITranslatableMessage } from '../TranslatableMessage'
import { ProtectedStringProperties } from '../protectedString'
import { RundownId, AdLibActionId, PartId } from './Ids'

/** The following extended interface allows assigning namespace information to the actions as they are stored in the
 *  database after being emitted from the blueprints
 */
export interface AdLibActionCommon extends ProtectedStringProperties<IBlueprintActionManifest, 'partId'> {
	rundownId: RundownId
	display: IBlueprintActionManifest['display'] & {
		label: ITranslatableMessage
		triggerLabel?: ITranslatableMessage
		description?: ITranslatableMessage
	}
	triggerModes?: (ArrayElement<IBlueprintActionManifest['triggerModes']> & {
		display: ArrayElement<IBlueprintActionManifest['triggerModes']>['display'] & {
			label: ITranslatableMessage
			description?: ITranslatableMessage
		}
	})[]
}

export interface AdLibAction extends AdLibActionCommon {
	_id: AdLibActionId
	partId: PartId
}
