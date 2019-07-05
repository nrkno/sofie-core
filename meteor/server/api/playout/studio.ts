import { Rundown, Rundowns } from '../../../lib/collections/Rundowns'

export function areThereActiveRundownsInStudio (studioId: string, excludeRundownId?: string): Rundown[] {
	let anyOtherActiveRundowns = Rundowns.find({
		studioId: studioId,
		active: true,
		_id: {
			$ne: excludeRundownId || ''
		}
	}).fetch()

	return anyOtherActiveRundowns
}
