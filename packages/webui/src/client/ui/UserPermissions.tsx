import React, { useEffect, useMemo, useState } from 'react'
import {
	getLocalAllowStudio,
	getLocalAllowConfigure,
	getLocalAllowDeveloper,
	getLocalAllowTesting,
	getLocalAllowService,
	setAllowStudio,
	setAllowConfigure,
	setAllowDeveloper,
	setAllowTesting,
	setAllowService,
} from '../lib/localStorage'
import { parse as queryStringParse } from 'query-string'

export interface UserPermissions {
	studio: boolean
	configure: boolean
	developer: boolean
	testing: boolean
	service: boolean
}

export const UserPermissionsContext = React.createContext<Readonly<UserPermissions>>({
	studio: false,
	configure: false,
	developer: false,
	testing: false,
	service: false,
})

export function useUserPermissions(): UserPermissions {
	const location = window.location

	const [permissions, setPermissions] = useState({
		studio: getLocalAllowStudio(),
		configure: getLocalAllowConfigure(),
		developer: getLocalAllowDeveloper(),
		testing: getLocalAllowTesting(),
		service: getLocalAllowService(),
	})

	useEffect(() => {
		if (!location.search) return

		const params = queryStringParse(location.search)

		if (params['studio']) setAllowStudio(params['studio'] === '1')
		if (params['configure']) setAllowConfigure(params['configure'] === '1')
		if (params['develop']) setAllowDeveloper(params['develop'] === '1')
		if (params['testing']) setAllowTesting(params['testing'] === '1')
		if (params['service']) setAllowService(params['service'] === '1')

		if (params['admin']) {
			const val = params['admin'] === '1'
			setAllowStudio(val)
			setAllowConfigure(val)
			setAllowDeveloper(val)
			setAllowTesting(val)
			setAllowService(val)
		}

		setPermissions({
			studio: getLocalAllowStudio(),
			configure: getLocalAllowConfigure(),
			developer: getLocalAllowDeveloper(),
			testing: getLocalAllowTesting(),
			service: getLocalAllowService(),
		})
	}, [location.search])

	// A naive memoizing of the value, to avoid reactions when the value is identical
	return useMemo(() => permissions, [JSON.stringify(permissions)])
}
