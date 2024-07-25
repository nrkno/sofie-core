import { MeteorMock } from '../../__mocks__/meteor'
import { testInFiber } from '../../__mocks__/helpers/jest'
import { memoizedIsolatedAutorun } from '../memoizedIsolatedAutorun'
import { Tracker } from 'meteor/tracker'

describe('memoizedIsolatedAutorun', () => {
	describe('Meteor.isServer', () => {
		beforeAll(() => {
			MeteorMock.mockSetServerEnvironment()
		})
		testInFiber('it returns the result of the autorun function', () => {
			const dep = new Tracker.Dependency()
			const result0 = memoizedIsolatedAutorun(() => {
				dep.depend()
				return 'result0'
			}, 'getResult0')
			expect(result0).toBe('result0')
		})
		testInFiber("it doesn't rerun when the dependency is changed", () => {
			let runCount = 0
			const dep = new Tracker.Dependency()
			const result1 = memoizedIsolatedAutorun(() => {
				runCount++
				dep.depend()
				return 'result1'
			}, 'getResult1')
			expect(result1).toBe('result1')
			expect(runCount).toBe(1)
			dep.changed()
			expect(runCount).toBe(1)
		})
	})
})
