let nextMockIndex = 9000

export function nanoid(): string {
	return 'randomId' + nextMockIndex++
}

export function restartRandomId(): void {
	nextMockIndex = 9000
}

export function resetRandomId(): void {
	// move the iterator forward and tie to next 1000
	// This will help with making the random id more consistend in tests
	nextMockIndex += 500
	nextMockIndex += 1000 - (nextMockIndex % 1000)
}

export function randomString(): string {
	return nanoid()
}

export function customAlphabet(): () => string {
	return nanoid
}
