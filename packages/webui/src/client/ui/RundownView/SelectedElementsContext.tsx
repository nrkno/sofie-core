import React from 'react'
import {
	AdLibActionId,
	PartId,
	PartInstanceId,
	PieceId,
	RundownId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'

enum SelectedElementType {
	RUNDOWN = 'rundown',
	SEGMENT = 'segment',
	PART = 'part',
	PIECE = 'piece',
	SHELF = 'shelf',
}

interface SelectedElement {
	id: string // Add unique identifier
	type: SelectedElementType
	// Id of the element - further investigation may be needed to point to correct element:
	element: RundownId | SegmentId | PartId | PartInstanceId | PieceId | AdLibActionId
}

interface SelectionContextType {
	selectedElements: Map<string, SelectedElement>
	isSelected: (elementId: string) => boolean
	toggleSelection: (element: SelectedElement) => void
	addSelection: (element: SelectedElement) => void
	removeSelection: (elementId: string) => void
	clearSelections: () => void
	getSelectedCount: () => number
}

export const SelectedElementsContext = React.createContext<SelectionContextType | null>(null)

export const SelectedElementProvider: React.FC<{
	children: React.ReactNode
	maxSelections?: number // Optional prop to limit maximum selections
}> = ({ children, maxSelections = 10 }) => {
	const [selectedElements, setSelectedElements] = React.useState<Map<string, SelectedElement>>(new Map())

	const value = React.useMemo(
		() => ({
			selectedElements,

			isSelected: (elementId: string) => {
				return selectedElements.has(elementId)
			},

			toggleSelection: (element: SelectedElement) => {
				setSelectedElements((prev) => {
					const next = new Map(prev)
					if (next.has(element.id)) {
						next.delete(element.id)
					} else if (next.size < maxSelections) {
						next.set(element.id, element)
					}
					return next
				})
			},

			addSelection: (element: SelectedElement) => {
				setSelectedElements((prev) => {
					if (prev.size >= maxSelections) return prev
					const next = new Map(prev)
					next.set(element.id, element)
					return next
				})
			},

			removeSelection: (elementId: string) => {
				setSelectedElements((prev) => {
					const next = new Map(prev)
					next.delete(elementId)
					return next
				})
			},

			clearSelections: () => {
				setSelectedElements(new Map())
			},

			getSelectedCount: () => {
				return selectedElements.size
			},
		}),
		[selectedElements, maxSelections]
	)

	return <SelectedElementsContext.Provider value={value}>{children}</SelectedElementsContext.Provider>
}

// Custom hook for using the selection context
export const useSelection = () => {
	const context = React.useContext(SelectedElementsContext)
	if (!context) {
		throw new Error('useSelection must be used within a SelectedElementProvider')
	}
	return context
}

// Helper hook for common selection patterns
export const useElementSelection = (element: SelectedElement) => {
	const { isSelected, toggleSelection } = useSelection()

	return {
		isSelected: React.useMemo(() => isSelected(element.id), [isSelected, element.id]),
		toggleSelection: React.useCallback(() => toggleSelection(element), [toggleSelection, element]),
	}
}
