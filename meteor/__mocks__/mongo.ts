
namespace MongoMock {
	export class Collection {
		localName: string
		constructor (localName: string) {
			this.localName = localName
		}
		find () {
			return {
				fetch () {
					return []
				},
				observeChanges () {
					// todo
				}
			}
		}
		update () {
			// todo
		}
		insert () {
			// todo
		}
		upsert () {
			// todo
		}

		allow () {
			// todo
		}
		observe () {
			// todo
		}
	}
}
export function setup () {
	return {
		Mongo: MongoMock
	}
}
