import { Random } from 'meteor/random';
import { check } from 'meteor/check';
import { Methods, setMeteorMethods } from '../methods';
import { ShowStylesAPI } from '../../lib/api/showStyles';
import { Meteor } from 'meteor/meteor';
import {
	ShowStyleBases,
	ShowStyleBase
} from '../../lib/collections/ShowStyleBases';
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants';
import { literal } from '../../lib/lib';
import { RundownLayouts } from '../../lib/collections/RundownLayouts';

export function insertShowStyleBase(): string {
	let id = ShowStyleBases.insert(
		literal<ShowStyleBase>({
			_id: Random.id(),
			name: 'New show style',
			blueprintId: '',
			outputLayers: [],
			sourceLayers: [],
			config: [],
			runtimeArguments: [],
			_rundownVersionHash: ''
		})
	);
	insertShowStyleVariant(id, 'Default');
	return id;
}
export function insertShowStyleVariant(
	showStyleBaseId: string,
	name?: string
): string {
	check(showStyleBaseId, String);

	let showStyleBase = ShowStyleBases.findOne(showStyleBaseId);
	if (!showStyleBase)
		throw new Meteor.Error(
			404,
			`showStyleBase "${showStyleBaseId}" not found`
		);

	return ShowStyleVariants.insert({
		_id: Random.id(),
		showStyleBaseId: showStyleBase._id,
		name: name || 'Variant',
		config: [],
		_rundownVersionHash: ''
	});
}
export function removeShowStyleBase(showStyleBaseId: string) {
	check(showStyleBaseId, String);

	ShowStyleBases.remove(showStyleBaseId);

	ShowStyleVariants.remove({
		showStyleBaseId: showStyleBaseId
	});

	RundownLayouts.remove({
		showStyleBaseId: showStyleBaseId
	});
}
export function removeShowStyleVariant(showStyleVariantId: string) {
	check(showStyleVariantId, String);

	ShowStyleVariants.remove(showStyleVariantId);
}

let methods: Methods = {};
methods[ShowStylesAPI.methods.insertShowStyleBase] = () => {
	return insertShowStyleBase();
};
methods[ShowStylesAPI.methods.insertShowStyleVariant] = (
	showStyleBaseId: string
) => {
	return insertShowStyleVariant(showStyleBaseId);
};
methods[ShowStylesAPI.methods.removeShowStyleBase] = (
	showStyleBaseId: string
) => {
	return removeShowStyleBase(showStyleBaseId);
};
methods[ShowStylesAPI.methods.removeShowStyleVariant] = (
	showStyleVariantId: string
) => {
	return removeShowStyleVariant(showStyleVariantId);
};

// Apply methods:
setMeteorMethods(methods);
