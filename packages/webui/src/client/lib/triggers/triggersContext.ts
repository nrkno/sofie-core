import { TriggersContext } from '@sofie-automation/meteor-lib/dist/triggers/triggersContext'
import { hashSingleUseToken } from '../lib'
import { MeteorCall } from '../meteorApi'
import { IBaseFilterLink } from '@sofie-automation/blueprints-integration'
import { doUserAction } from '../clientUserAction'
import { memoizedIsolatedAutorun } from '../memoizedIsolatedAutorun'
import { Tracker } from 'meteor/tracker'
import {
	AdLibActions,
	AdLibPieces,
	Parts,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
	Rundowns,
	Segments,
} from '../../collections'
import { logger } from '../logging'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReactivePlaylistActionContext } from '@sofie-automation/meteor-lib/dist/triggers/actionFactory'

export const UiTriggersContext: TriggersContext = {
	MeteorCall,

	logger,

	isClient: true,

	AdLibActions,
	AdLibPieces,
	Parts,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
	Rundowns,
	Segments,

	hashSingleUseToken,

	doUserAction,

	nonreactiveTracker: Tracker.nonreactive,

	memoizedIsolatedAutorun,

	createContextForRundownPlaylistChain(
		_studioId: StudioId,
		_filterChain: IBaseFilterLink[]
	): ReactivePlaylistActionContext | undefined {
		// Server only

		throw new Error('Invalid filter combination')
	},
}
