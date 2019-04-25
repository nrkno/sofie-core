test('mockTest', () => {
	expect(1).toEqual(1)
})
/*
import { Meteor } from 'meteor/meteor'
import { saveIntoDb } from '../../lib/lib'
import { Studios } from '../../lib/collections/Studios'
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
	saveIntoDb(Studios, {
		_id: 'test'
	}, [{
		// @ts-ignore
		_id: 'test', prop0: 'a', prop1: 'b',
	}])
	let s0 = Studios.findOne('test')
	test(s0, {_id: 'test', prop0: 'a', prop1: 'b',})

	console.log('test2')
	saveIntoDb(Studios, {
		_id: 'test'
	}, [{
		// @ts-ignore
		_id: 'test', prop1: 'b2', prop2: 'c'
	}])
	let s1 = Studios.findOne('test')
	test(s1, {_id: 'test', prop1: 'b2', prop2: 'c'})

	saveIntoDb(Studios, {
		_id: 'test'
	}, [])

	let s2 = Studios.findOne('test')

	console.log(s2)

	console.log('All is good!')

})
*/
