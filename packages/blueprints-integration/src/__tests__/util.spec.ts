import { iterateDeeply, iterateDeeplyAsync, iterateDeeplyEnum } from '../util'

describe('Util', () => {
	test('iterateDeeply', () => {
		expect(
			iterateDeeply(
				{
					attr0: {
						subattr0: {
							_txt: 'foo',
						},
						subattr1: 'world',
					},
					attr1: 'hello',
				},
				(val) => {
					if (typeof val === 'object') {
						if (val._txt) {
							return val._txt
						}
					}
					return iterateDeeplyEnum.CONTINUE
				}
			)
		).toEqual({
			attr0: {
				subattr0: 'foo',
				subattr1: 'world',
			},
			attr1: 'hello',
		})
	})

	test('iterateDeeplyAsync', async () => {
		expect(
			await iterateDeeplyAsync(
				{
					attr0: {
						subattr0: {
							_txt: 'foo',
						},
						subattr1: 'world',
					},
					attr1: 'hello',
				},
				(val) => {
					return new Promise((resolve) => {
						const f = () => {
							if (typeof val === 'object') {
								if (val._txt) {
									return val._txt
								}
							}
							return iterateDeeplyEnum.CONTINUE
						}
						setTimeout(() => {
							resolve(f())
						}, 10)
					})
				}
			)
		).toEqual({
			attr0: {
				subattr0: 'foo',
				subattr1: 'world',
			},
			attr1: 'hello',
		})
	})
})
