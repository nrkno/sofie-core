import { ShowStyleVariantId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

/**
 * This whole ConfigRef logic will need revisiting for a multi-studio context, to ensure that there are strict boundaries across who can give to access to what.
 * Especially relevant for multi-user.
 */
// export namespace ConfigRef {

export function getStudioConfigRef(studioId: StudioId, configKey: string): string {
	return '${studio.' + studioId + '.' + configKey + '}'
}
export function getShowStyleConfigRef(showStyleVariantId: ShowStyleVariantId, configKey: string): string {
	return '${showStyle.' + showStyleVariantId + '.' + configKey + '}'
}
