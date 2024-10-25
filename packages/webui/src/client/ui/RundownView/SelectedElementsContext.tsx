import React from 'react'
import {
	AdLibActionId,
	PartInstanceId,
	PieceId,
	RundownId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { assertNever } from '@sofie-automation/corelib/dist/lib'

interface RundownElement {
	type: 'rundown'
	elementId: RundownId
}

interface SegmentElement {
	type: 'segment'
	elementId: SegmentId
}

interface PartInstanceElement {
	type: 'partInstance'
	elementId: PartInstanceId
}

interface PieceElement {
	type: 'piece'
	elementId: PieceId
}

interface AdlibActionElement {
	type: 'adlibAction'
	elementId: AdLibActionId
}

// Union types for all possible elements
type SelectedElement = RundownElement | SegmentElement | PartInstanceElement | PieceElement | AdlibActionElement
type ElementId = SelectedElement['elementId']

interface SelectionContextType {
	isSelected: (elementId: ElementId) => boolean
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
	| { type: 'REMOVE_SELECTION'; payload: ElementId }
	| { type: 'CLEAR_SELECTIONS' }

// Reducer function
const selectionReducer = (
	state: Map<ElementId, SelectedElement>,
	action: SelectionAction,
	maxSelections: number
): Map<ElementId, SelectedElement> => {
	switch (action.type) {
		case 'CLEAR_AND_SET_SELECTION': {
			const newMap = new Map([[action.payload.elementId, action.payload]])
			return newMap
		}
		case 'TOGGLE_SELECTION': {
			const next = new Map(state)
			if (next.has(action.payload.elementId)) {
				next.delete(action.payload.elementId)
			} else if (next.size < maxSelections) {
				next.set(action.payload.elementId, action.payload)
			}
			return next
		}
		case 'ADD_SELECTION': {
			if (state.size >= maxSelections) return state
			const next = new Map(state)
			next.set(action.payload.elementId, action.payload)
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
			assertNever(action)
			return state
	}
}

export const SelectedElementsContext = React.createContext<SelectionContextType | null>(null)

export const SelectedElementProvider: React.FC<{
	children: React.ReactNode
	maxSelections?: number // Optional prop to limit maximum selections
}> = ({ children, maxSelections = 10 }) => {
	const [selectedElements, dispatch] = React.useReducer(
		(state: Map<ElementId, SelectedElement>, action: SelectionAction) => selectionReducer(state, action, maxSelections),
		new Map()
	)

	const value = React.useMemo(
		() => ({
			isSelected: (elementId: ElementId) => {
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

			removeSelection: (elementId: ElementId) => {
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
