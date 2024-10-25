import React from 'react'
import {
	AdLibActionId,
	PartInstanceId,
	PieceId,
	RundownId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'

interface RundownElement {
	type: 'rundown'
	id: string
	elementId: RundownId
}

interface SegmentElement {
	type: 'segment'
	id: string
	elementId: SegmentId
}

interface PartInstanceElement {
	type: 'partInstance'
	id: string
	elementId: PartInstanceId
}

interface PieceElement {
	type: 'piece'
	id: string
	elementId: PieceId
}

interface AdlibActionElement {
	type: 'adlibAction'
	id: string
	elementId: AdLibActionId
}

// Union type for all possible elements
type SelectedElement = RundownElement | SegmentElement | PartInstanceElement | PieceElement | AdlibActionElement

interface SelectionContextType {
	isSelected: (elementId: string) => boolean
	listSelectedElements: () => SelectedElement[]
	clearAndSetSelection: (element: SelectedElement) => void
	toggleSelection: (element: SelectedElement) => void
	addSelection: (element: SelectedElement) => void
	removeSelection: (elementId: string) => void
	clearSelections: () => void
	getSelectedCount: () => number
}

type SelectionAction =
	| { type: 'CLEAR_AND_SET_SELECTION'; payload: SelectedElement }
	| { type: 'TOGGLE_SELECTION'; payload: SelectedElement }
	| { type: 'ADD_SELECTION'; payload: SelectedElement }
	| { type: 'REMOVE_SELECTION'; payload: string }
	| { type: 'CLEAR_SELECTIONS' }

// Reducer function
const selectionReducer = (
	state: Map<string, SelectedElement>,
	action: SelectionAction,
	maxSelections: number
): Map<string, SelectedElement> => {
	switch (action.type) {
		case 'CLEAR_AND_SET_SELECTION': {
			const newMap = new Map([[action.payload.id, action.payload]])
			return newMap
		}
		case 'TOGGLE_SELECTION': {
			const next = new Map(state)
			if (next.has(action.payload.id)) {
				next.delete(action.payload.id)
			} else if (next.size < maxSelections) {
				next.set(action.payload.id, action.payload)
			}
			return next
		}
		case 'ADD_SELECTION': {
			if (state.size >= maxSelections) return state
			const next = new Map(state)
			next.set(action.payload.id, action.payload)
			return next
		}
		case 'REMOVE_SELECTION': {
			const next = new Map(state)
			next.delete(action.payload)
			return next
		}
		case 'CLEAR_SELECTIONS': {
			return new Map()
		}
		default:
			return state
	}
}

export const SelectedElementsContext = React.createContext<SelectionContextType | null>(null)

export const SelectedElementProvider: React.FC<{
	children: React.ReactNode
	maxSelections?: number // Optional prop to limit maximum selections
}> = ({ children, maxSelections = 10 }) => {
	const [selectedElements, dispatch] = React.useReducer(
		(state: Map<string, SelectedElement>, action: SelectionAction) => selectionReducer(state, action, maxSelections),
		new Map()
	)

	const value = React.useMemo(
		() => ({
			isSelected: (elementId: string) => {
				return selectedElements.has(elementId)
			},

			listSelectedElements: () => {
				return Array.from(selectedElements.values())
			},

			clearAndSetSelection: (element: SelectedElement) => {
				dispatch({ type: 'CLEAR_AND_SET_SELECTION', payload: element })
			},

			toggleSelection: (element: SelectedElement) => {
				dispatch({ type: 'TOGGLE_SELECTION', payload: element })
			},

			addSelection: (element: SelectedElement) => {
				dispatch({ type: 'ADD_SELECTION', payload: element })
			},

			removeSelection: (elementId: string) => {
				dispatch({ type: 'REMOVE_SELECTION', payload: elementId })
			},

			clearSelections: () => {
				dispatch({ type: 'CLEAR_SELECTIONS' })
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
export const useSelection = (): SelectionContextType => {
	const context = React.useContext(SelectedElementsContext)
	if (!context) {
		throw new Error('useSelection must be used within a SelectedElementProvider')
	}
	return context
}

// Helper hook for common selection patterns
export const useElementSelection = (element: SelectedElement): { isSelected: boolean; toggleSelection: () => void } => {
	const { isSelected, toggleSelection } = useSelection()

	return {
		isSelected: React.useMemo(() => isSelected(element.id), [isSelected, element.id]),
		toggleSelection: React.useCallback(() => toggleSelection(element), [toggleSelection, element]),
	}
}
