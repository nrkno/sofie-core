const randomChars = 'abcdefghifklmnopqrstuvxyzABCDEFGHIFKLMNOPQRSTUVXYZ0123456789'
const randomCharsCount = randomChars.length - 1
function randomChar(): string {
	return randomChars[Math.floor(Math.random() * randomCharsCount)]
}
function randomFastId(numberOfChars = 17): string {
	let str = ''
	for (let i = 0; i < numberOfChars; i++) {
		str += randomChar()
	}
	return str
}
export class Random {
	// TODO - this needs to be made browser safe
	public static id(digits = 17): string {
		return randomFastId(digits)
	}
}
