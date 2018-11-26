import { Meteor } from 'meteor/meteor'
import { saveIntoDb } from '../../lib/lib'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import * as _ from 'underscore'

// tmp!
Meteor.startup(() => {
	function test (a, b) {
		a = JSON.parse(JSON.stringify(a))
		b = JSON.parse(JSON.stringify(b))

		if (!_.isEqual(a, b)) {
			console.log('Not equal:')
			console.log(JSON.stringify(a))
			console.log(JSON.stringify(b))
			throw new Meteor.Error('Not equal!')
		}
	}
	console.log('test1')
	saveIntoDb(StudioInstallations, {
		_id: 'test'
	}, [{
		// @ts-ignore
		_id: 'test', prop0: 'a', prop1: 'b',
	}])
	let s0 = StudioInstallations.findOne('test')
	test(s0, {_id: 'test', prop0: 'a', prop1: 'b',})

	console.log('test2')
	saveIntoDb(StudioInstallations, {
		_id: 'test'
	}, [{
		// @ts-ignore
		_id: 'test', prop1: 'b2', prop2: 'c'
	}])
	let s1 = StudioInstallations.findOne('test')
	test(s1, {_id: 'test', prop1: 'b2', prop2: 'c'})

	saveIntoDb(StudioInstallations, {
		_id: 'test'
	}, [])

	let s2 = StudioInstallations.findOne('test')

	console.log(s2)

	console.log('All is good!')

})
