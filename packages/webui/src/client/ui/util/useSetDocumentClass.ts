import { useEffect } from 'react'

/**
 * Adds the provided classes to `document.body` upon mount, and removes them when unmounted
 * @param classNames Classnames to add
 */
export function useSetDocumentClass(...classNames: string[]): void {
	useEffect(() => {
		document.body.classList.add(...classNames)

		return () => {
			document.body.classList.remove(...classNames)
		}
	}, [JSON.stringify(classNames)])
}
