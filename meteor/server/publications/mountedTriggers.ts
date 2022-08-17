import { Meteor } from 'meteor/meteor'
import { RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { DBShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { DBPartInstance, PartInstances } from '../../lib/collections/PartInstances'
import { DBRundown, Rundowns } from '../../lib/collections/Rundowns'
import { observerChain } from '../lib/observerChain'
import { MongoCursor } from '../../lib/collections/lib'
import { protectString } from '../../lib/lib'

Meteor.startup(() => {
	observerChain()
		.next('activePlaylist', () =>
			RundownPlaylists.find({ activationId: { $exists: true }, studioId: protectString('studio0') })
		)
		.next('activePartInstance', (chain) => {
			const activePartInstanceId =
				chain.activePlaylist.currentPartInstanceId ?? chain.activePlaylist.nextPartInstanceId
			if (!activePartInstanceId) return null
			return PartInstances.find(
				{ _id: activePartInstanceId },
				{ fields: { rundownId: 1 }, limit: 1 }
			) as MongoCursor<Pick<DBPartInstance, '_id' | 'rundownId'>>
		})
		.next('currentRundown', (chain) =>
			chain.activePartInstance
				? (Rundowns.find(
						{ _id: chain.activePartInstance.rundownId },
						{ fields: { showStyleBaseId: 1 }, limit: 1 }
				  ) as MongoCursor<Pick<DBRundown, '_id' | 'showStyleBaseId'>>)
				: null
		)
		.next('showStyleBase', (chain) =>
			chain.currentRundown
				? (ShowStyleBases.find(
						{ _id: chain.currentRundown.showStyleBaseId },
						{ fields: { sourceLayers: 1, outputLayers: 1, hotkeyLegend: 1 }, limit: 1 }
				  ) as MongoCursor<Pick<DBShowStyleBase, '_id' | 'sourceLayers' | 'outputLayers' | 'hotkeyLegend'>>)
				: null
		)
		.end((state) => {
			console.log(JSON.stringify(state))
		})
})
