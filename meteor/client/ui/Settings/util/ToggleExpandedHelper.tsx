import { useState, useCallback } from 'react'

export function useToggleExpandHelper() {
	const [expandedItemIds, setExpandedItemIds] = useState({})

	const toggleExpanded = useCallback((itidmId: string, forceState?: boolean) => {
		setExpandedItemIds((oldExpanded) => {
			// This will leak entries as layers are added and removed, but not fast enough to be a problem
			return {
				...oldExpanded,
				[itidmId]: forceState ?? !oldExpanded[itidmId],
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
