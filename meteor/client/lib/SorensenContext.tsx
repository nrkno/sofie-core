import React, { useEffect, useState } from 'react'
import Sorensen from 'sorensen'

export const SorensenContext = React.createContext<typeof Sorensen | null>(null)

function preventDefault(e: KeyboardEvent) {
	e.preventDefault()
}

export const SorensenContextProvider: React.FC = function SorensenContextProvider(props) {
	const [initializedSorensen, setInitializedSorensen] = useState<typeof Sorensen | null>(null)
	useEffect(() => {
		Sorensen.init()
			.then(() => {
				setInitializedSorensen(Sorensen)
			})
			.catch(console.error)

		return () => {
			Sorensen.destroy().catch(console.error)
		}
	}, [])

	useEffect(() => {
		if (initializedSorensen) {
			// block default F1 behavior (opening help)
			Sorensen.bind('F1', preventDefault, {
				global: true,
			})
			// block default F3 behavior (opening search)
			Sorensen.bind('F3', preventDefault, {
				global: true,
			})
			// block default Space behavior (scroll page down)
			Sorensen.bind('Space', preventDefault, {
				global: false,
			})
			// block default Alt behavior (focus Window Menu)
			Sorensen.bind('Alt', preventDefault, {
				global: true,
				up: true,
			})
		}
	}, [initializedSorensen])

	return <SorensenContext.Provider value={initializedSorensen}>{props.children}</SorensenContext.Provider>
}
