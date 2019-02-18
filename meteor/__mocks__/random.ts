
export class RandomMock {

	static mockIds: Array<string> = []
	static id (): string {
		let id = this.mockIds.shift()
		if (!id) id = 'id_' + Math.round((Math.random() * 100000))
		return id
	}
}
