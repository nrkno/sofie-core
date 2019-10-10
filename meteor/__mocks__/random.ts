
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
	RandomMock.mockI = 9000
}
