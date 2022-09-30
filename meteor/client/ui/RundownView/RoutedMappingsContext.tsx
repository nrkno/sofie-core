import React from 'react'
import { RoutedMappings } from '../../../lib/collections/Studios'

type RoutedMappingsFromContext = RoutedMappings | undefined

const RoutedMappingsContext = React.createContext<RoutedMappingsFromContext>(undefined)

export default RoutedMappingsContext
