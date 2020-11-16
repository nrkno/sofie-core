import * as crypto from 'crypto'

export class Random {
	static UNMISTAKABLE_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz'
	public static id(digits = 17): string {
		let id = ''
		const bytes = crypto.randomBytes(digits)
		for (let x = 0; x < digits; x++) {
			id += this.UNMISTAKABLE_CHARS[bytes[x] % digits]
		}
		return id
	}
}
