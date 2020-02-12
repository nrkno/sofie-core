
export class RandomMock {

	static mockIds: Array<string> = []
	static mockI: number = 9000

	static id (): string {
		let id = this.mockIds.shift()
		if (!id) id = 'randomId' + RandomMock.mockI++
		return id
	}
}
export function setup () {
	return {
		Random: RandomMock
	}
}

export function resetRandomId () {
	// move the iterator forward and tie to next 1000
	// This will help with making the random id more consistend in tests
	RandomMock.mockI += 500
	RandomMock.mockI += 1000 - (RandomMock.mockI % 1000)
}
