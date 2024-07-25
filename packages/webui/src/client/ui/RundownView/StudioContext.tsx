import React from 'react'
import { UIStudio } from '../../../lib/api/studios'

type StudioFromContext = UIStudio | undefined

const StudioContext = React.createContext<StudioFromContext>(undefined)

export default StudioContext
