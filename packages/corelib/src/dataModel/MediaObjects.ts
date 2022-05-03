import { ProtectedString } from '../protectedString'

export interface MediaObjects {
	_id: ProtectedString<'MediaObjId'>
	mediainfo?: {
		format?: {
			duration: number
		}
	}
}
