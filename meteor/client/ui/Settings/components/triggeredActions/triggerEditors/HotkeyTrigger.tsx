import * as React from 'react'
import { useContext } from 'react'
import { SorensenContext } from '../TriggeredActionsEditor'

function toTitleCase(input: string): string {
	const str = input.toLowerCase().split(' ')
	for (let i = 0; i < str.length; i++) {
		str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1)
	}
	return str.join(' ')
}

export const HotkeyTrigger = ({ keys }: { keys: string }) => {
	const Sorensen = useContext(SorensenContext)

	if (Sorensen) {
		keys = keys
			.split(/\s+/gi)
			.map((note) =>
				note
					.split(/\+/gi)
					.map((code) => toTitleCase(Sorensen.getKeyForCode(code)))
					.join('+')
			)
			.join(' ')
	}

	return <div className="triggered-action-entry__hotkey">{keys}</div>
}
