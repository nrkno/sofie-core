import React from 'react'
import { DndProviderProps } from 'react-dnd'

/**
 * This is a patch to allow our React-DnD to work with React 18
 */

// declare module 'react-dnd' {
// 	export const DndProvider: React.FC<React.PropsWithChildren<DndProviderProps<any, any>>>
// }
