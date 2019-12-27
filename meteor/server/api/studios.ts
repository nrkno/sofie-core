import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { check } from 'meteor/check';
import { Methods, setMeteorMethods } from '../methods';
import { StudiosAPI } from '../../lib/api/studios';
import { Studios, Studio, DBStudio } from '../../lib/collections/Studios';
import { literal } from '../../lib/lib';
import { Rundown, Rundowns } from '../../lib/collections/Rundowns';
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices';

export function insertStudio(newId?: string): string {
	if (newId) check(newId, String);

	let id = Studios.insert(
		literal<DBStudio>({
			_id: newId || Random.id(),
			name: 'New Studio',
			// blueprintId?: string
			mappings: {},
			supportedShowStyleBase: [],
			config: [],
			// testToolsConfig?: ITestToolsConfig
			settings: {
				mediaPreviewsUrl: '',
				sofieUrl: ''
			},
			_rundownVersionHash: ''
		})
	);
	return id;
}
export function removeStudio(id: string): void {
	check(id, String);

	const studio = Studios.findOne(id);
	if (!studio) throw new Meteor.Error(404, `Studio "${id}" not found`);

	// allowed to remove?
	const rundown = Rundowns.findOne({ studioId: studio._id });
	if (rundown)
		throw new Meteor.Error(
			404,
			`Can't remoce studio "${id}", because the rundown "${rundown._id}" is in it.`
		);

	const peripheralDevice = PeripheralDevices.findOne({
		studioId: studio._id
	});
	if (peripheralDevice)
		throw new Meteor.Error(
			404,
			`Can't remoce studio "${id}", because the peripheralDevice "${peripheralDevice._id}" is in it.`
		);

	Studios.remove(id);
}

let methods: Methods = {};
methods[StudiosAPI.methods.insertStudio] = () => {
	return insertStudio();
};
methods[StudiosAPI.methods.removeStudio] = (showStyleBaseId: string) => {
	return removeStudio(showStyleBaseId);
};

// Apply methods:
setMeteorMethods(methods);
