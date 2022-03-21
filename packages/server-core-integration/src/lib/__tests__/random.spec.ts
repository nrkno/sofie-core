import { Random } from '../random'

it('generates a random number - default length 17', () => {
	const r = Random.id()
	expect(r).toHaveLength(17)
	for (let x = 0; x < r.length; x++) {
		expect(Random.UNMISTAKABLE_CHARS.indexOf(r[x])).toBeGreaterThanOrEqual(0)
	}
})

it('can generate a value of a given length', () => {
	const r = Random.id(42)
	expect(r).toHaveLength(42)
	for (let x = 0; x < r.length; x++) {
		expect(Random.UNMISTAKABLE_CHARS.indexOf(r[x])).toBeGreaterThanOrEqual(0)
	}
})

it('does the right thing for zero length', () => {
	const r = Random.id(0)
	expect(r).toHaveLength(0)
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
