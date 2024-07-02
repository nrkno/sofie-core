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
			const strings: string[] = []
			if (typeof (error as any).rawError === 'string') strings.push(`${(error as any).rawError}`) // Is an UserError
			if (typeof (error as Error).message === 'string') strings.push(`${(error as Error).message}`) // Is an Error
			if (typeof (error as any).reason === 'string') strings.push(`${(error as any).reason}`) // Is a Meteor.Error
			if (typeof (error as any).details === 'string') strings.push(` ${(error as any).details}`)

			str = strings.join(', ')
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
		if (error && typeof error === 'object' && typeof (error as any).stack === 'string') {
			str += ', ' + (error as any).stack
		}
	}

	if (str.startsWith('Error: ')) str = str.slice('Error: '.length)

	return str
}
