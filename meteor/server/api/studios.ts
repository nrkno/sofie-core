import { Meteor } from 'meteor/meteor'
import { registerClassToMeteorMethods } from '../methods'
import { NewStudiosAPI, StudiosAPIMethods } from '../../lib/api/studios'
import { Studios, DBStudio, StudioId } from '../../lib/collections/Studios'
import { literal, getRandomId, makePromise, check } from '../../lib/lib'
import { Rundowns } from '../../lib/collections/Rundowns'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'

export function insertStudio(newId?: StudioId): StudioId {
	if (newId) check(newId, String)

	let id = Studios.insert(
		literal<DBStudio>({
			_id: newId || getRandomId(),
			name: 'New Studio',
			// blueprintId?: BlueprintId
			mappings: {},
			supportedShowStyleBase: [],
			blueprintConfig: {},
			// testToolsConfig?: ITestToolsConfig
			settings: {
				mediaPreviewsUrl: '',
				sofieUrl: '',
			},
			_rundownVersionHash: '',
		})
	)
	return id
}
export function removeStudio(id: StudioId): void {
	check(id, String)

	const studio = Studios.findOne(id)
	if (!studio) throw new Meteor.Error(404, `Studio "${id}" not found`)

	// allowed to remove?
	const rundown = Rundowns.findOne({ studioId: studio._id })
	if (rundown)
		throw new Meteor.Error(404, `Can't remoce studio "${id}", because the rundown "${rundown._id}" is in it.`)

	const peripheralDevice = PeripheralDevices.findOne({ studioId: studio._id })
	if (peripheralDevice)
		throw new Meteor.Error(
			404,
			`Can't remoce studio "${id}", because the peripheralDevice "${peripheralDevice._id}" is in it.`
		)

	Studios.remove(id)
}

class ServerStudiosAPI implements NewStudiosAPI {
	insertStudio() {
		return makePromise(() => insertStudio())
	}
	removeStudio(studioId: StudioId) {
		return makePromise(() => removeStudio(studioId))
	}
}
registerClassToMeteorMethods(StudiosAPIMethods, ServerStudiosAPI, false)
