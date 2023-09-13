/** Make a string out of an error (or other equivalents), including any additional data such as stack trace if available */
export function stringifyError(error: unknown, noStack = false): string {
	let str: string | undefined = undefined

	if (error && typeof error === 'object') {
		if (Array.isArray(error)) {
			return error.map((e) => stringifyError(e)).join(', ')
		}

		if ((error as any).toString && (error as any).toString !== Object.prototype.toString) {
			// Has a custom toString() method
			str = `${(error as any).toString()}`
		} else {
			str = ''
			if ((error as Error).message) str += `${(error as Error).message} ` // Is an Error
			if ((error as any).reason) str += `${(error as any).reason} ` // Is a Meteor.Error
			if ((error as any).details) str += `${(error as any).details} `
		}

		if (!str) {
			try {
				// Try to stringify the object:
				str = JSON.stringify(error)
			} catch (e) {
				str = `${error} (stringifyError: ${e})`
			}
		}

		// Is an instance of a class (like KeyboardEvent):
		const instanceName = error.constructor?.name
		if (instanceName && instanceName !== 'Object' && instanceName !== 'Array') str = `${instanceName}: ${str}`
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
