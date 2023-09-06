/** Make a string out of an error (or other equivalents), including any additional data such as stack trace if available */
export function stringifyError(error: unknown, noStack = false): string {
	let str: string | undefined = undefined

	if (error && typeof error === 'object') {
		if (Array.isArray(error)) {
			return error.map((e) => stringifyError(e)).join(', ')
		}

		str = ''
		// Is an instance of a class (like KeyboardEvent):
		const instanceName = error.constructor?.name
		if (instanceName && instanceName !== 'Object' && instanceName !== 'Array') str += `${error.constructor.name}: `

		if ((error as any).toString && (error as any).toString !== Object.prototype.toString) {
			// Has a custom toString() method
			str += `${(error as any).toString()}`
		} else if ((error as Error).message) {
			console.log('b', (error as Error).message)
			// Is an Error
			str += `${(error as Error).message}`
		} else if ((error as any).reason) {
			// Is a Meteor.Error
			str += `${(error as any).reason}`
		} else if ((error as any).details) {
			str += `${(error as any).details}`
		} else {
			try {
				// Try to stringify the object:
				str += JSON.stringify(error)
			} catch (e) {
				str += `${error} (stringifyError: ${e})`
			}
		}
	} else {
		str = `${error}`
	}

	if (!noStack) {
		if (error && typeof error === 'object' && (error as any).stack) {
			str += ', ' + (error as any).stack
		}
	}

	return str
}
