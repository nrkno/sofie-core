import { useState, useCallback } from 'react'

export function useToggleExpandHelper(): {
	toggleExpanded(id: string, forceState?: boolean): void
	isExpanded(id: string): boolean
} {
	const [expandedItemIds, setExpandedItemIds] = useState({})

	const toggleExpanded = useCallback((id: string, forceState?: boolean) => {
		setExpandedItemIds((oldExpanded) => {
			// This will leak entries as layers are added and removed, but not fast enough to be a problem
			return {
				...oldExpanded,
				[id]: forceState ?? !oldExpanded[id],
			}
		})
	}, [])

	const isExpanded = (id: string): boolean => {
		return !!expandedItemIds[id]
	}

	return {
		toggleExpanded,
		isExpanded,
	}
}
