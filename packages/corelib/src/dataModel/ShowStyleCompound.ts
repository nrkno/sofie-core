import { ShowStyleVariantId } from './Ids'
import { DBShowStyleBase } from './ShowStyleBase'

export interface ShowStyleCompound extends DBShowStyleBase {
	showStyleVariantId: ShowStyleVariantId
	_rundownVersionHashVariant: string
}
