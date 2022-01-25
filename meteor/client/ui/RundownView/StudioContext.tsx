import React from 'react'
import { Studio } from '../../../lib/collections/Studios'

type StudioFromContext = Studio | undefined

const StudioContext = React.createContext<StudioFromContext>(undefined)

export default StudioContext
