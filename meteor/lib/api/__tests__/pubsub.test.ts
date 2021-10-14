import { PubSub } from '../pubsub'

describe('Pubsub', () => {
	it('Ensures that PubSub values are unique', () => {
		const values: { [key: string]: true } = {}
		for (const key in PubSub) {
			expect(values[key]).toBeFalsy()
			values[key] = true
		}
		expect(Object.keys(values).length).toBeGreaterThan(10)
	})
})
