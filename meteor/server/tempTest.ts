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

export function tempTestAsync (a: number, b: number, c: number): number {
	// console.log('tempTestAsyncInner', tempTestAsyncInner)
	// console.log('a')
	const val = tempTestAsyncInner(a, b) + c
	// console.log('d')
	return val
}

const tempTestAsyncInner = Meteor.wrapAsync((val0, val1, cb) => {
	// console.log('b')
	setTimeout(() => {
		// console.log('c')
		cb(undefined, val0 + val1)
	}, 100)
	// console.log('b2')
})
export const functionToTest = Meteor.wrapAsync((value: string, cb: Function) => {
	setTimeout(() => {
		cb(null, value)
	}, 100)
})
