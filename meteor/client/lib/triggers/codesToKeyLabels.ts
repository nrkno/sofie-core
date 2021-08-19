import type { Sorensen } from '@sofie-automation/sorensen'

function toTitleCase(input: string): string {
	const str = input.split(' ')
	for (let i = 0; i < str.length; i++) {
		str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1)
	}
	return str.join(' ')
}

export function codesToKeyLabels(keys: string, sorensen: Sorensen) {
	return keys
		.split(/\s+/gi)
		.map((note) =>
			note
				.split(/\+/gi)
				.map((code) => toTitleCase(sorensen.getKeyForCode(code)))
				.join('+')
		)
		.join(' ')
}
