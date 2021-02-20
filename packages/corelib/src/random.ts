import * as crypto from 'crypto'

// TODO - copied from server-core-integration
export class Random {
	static UNMISTAKABLE_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz'
	// TODO - this needs to be made browser safe
	public static id(digits: number = 17): string {
		let id = ''
		const bytes = crypto.randomBytes(digits)
		for (let x = 0; x < digits; x++) {
			id += this.UNMISTAKABLE_CHARS[bytes[x] % digits]
		}
		return id
	}
}
