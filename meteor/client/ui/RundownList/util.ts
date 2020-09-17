import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link } from 'react-router-dom'
import { RundownLayoutBase, RundownLayoutId } from '../../../lib/collections/RundownLayouts'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { RundownId } from '../../../lib/collections/Rundowns'
import { ShowStyleBaseId } from '../../../lib/collections/ShowStyleBases'
import { StudioId } from '../../../lib/collections/Studios'
import { unprotectString } from '../../../lib/lib'
import { JsxEmit } from 'typescript'

export function getRundownPlaylistLink(rundownPlaylistId: RundownPlaylistId): string {
	// double encoding so that "/" are handled correctly
	const encodedId = encodeURIComponent(encodeURIComponent(unprotectString(rundownPlaylistId)))

	return `/rundown/${encodedId}`
}

export function getStudioLink(studioId: StudioId): string {
	// double encoding so that "/" are handled correctly
	const encodedId = encodeURIComponent(encodeURIComponent(unprotectString(studioId)))

	return `/settings/studio/${encodedId}`
}

export function getShowStyleBaseLink(showStyleBaseId: ShowStyleBaseId): string {
	// double encoding so that "/" are handled correctly
	const encodedId = encodeURIComponent(encodeURIComponent(unprotectString(showStyleBaseId)))

	return `/settings/showStyleBase/${encodedId}`
}

export function getShelfLink(rundownId: RundownId | RundownPlaylistId, layoutId: RundownLayoutId): string {
	// double encoding so that "/" are handled correctly
	const encodedRundownId = encodeURIComponent(encodeURIComponent(unprotectString(rundownId)))
	const encodedLayoutId = encodeURIComponent(encodeURIComponent(unprotectString(layoutId)))

	return `/rundown/${encodedRundownId}/shelf/?layout=${encodedLayoutId}`
}

export function getRundownWithLayoutLink(rundownId: RundownId | RundownPlaylistId, layoutId: RundownLayoutId): string {
	// double encoding so that "/" are handled correctly
	const encodedRundownId = encodeURIComponent(encodeURIComponent(unprotectString(rundownId)))
	const encodedLayoutId = encodeURIComponent(encodeURIComponent(unprotectString(layoutId)))

	return `/rundown/${encodedRundownId}?layout=${encodedLayoutId}`
}
