import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
// import { SimpleSchema } from 'meteor/aldeed:simple-schema'
// @ts-ignore
import { ValidatedMethod } from 'meteor/mdg:validated-method'

export const addFoo = function () {
	Meteor.loginWithPassword('sene', 'nsie')
	return new ValidatedMethod({
		name: 'Foo.add',
		validate: undefined,
		run (bar) {
			console.log('foo', bar)
		},
	})
}

export function tempTestRandom () {
	return Random.id()
}
