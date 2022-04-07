import { Random } from '../random'

it('generates a random number - default length 17', () => {
	const str = Random.id()
	expect(str).toHaveLength(17)
	for (const char of str) {
		expect(Random.UNMISTAKABLE_CHARS.indexOf(char)).toBeGreaterThanOrEqual(0)
	}
})

it('can generate a value of a given length', () => {
	const str = Random.id(42)
	expect(str).toHaveLength(42)
	for (const char of str) {
		expect(Random.UNMISTAKABLE_CHARS.indexOf(char)).toBeGreaterThanOrEqual(0)
	}
})

it('does the right thing for zero length', () => {
	const str = Random.id(0)
	expect(str).toHaveLength(0)
})

it('throws with a negative length', () => {
	expect(() => {
		Random.id(-1)
	}).toThrow()
})

it('does not do the same thing twice', () => {
	const r = Random.id()
	const s = Random.id()
	expect(r).not.toEqual(s)
})
