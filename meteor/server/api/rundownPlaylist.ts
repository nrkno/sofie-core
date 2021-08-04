import { RundownId, Rundowns } from '../../lib/collections/Rundowns'
import { AdLibActions } from '../../lib/collections/AdLibActions'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { ExpectedPlayoutItems } from '../../lib/collections/ExpectedPlayoutItems'
import { IngestDataCache } from '../../lib/collections/IngestDataCache'
import { PartInstances } from '../../lib/collections/PartInstances'
import { Parts } from '../../lib/collections/Parts'
import { PieceInstances } from '../../lib/collections/PieceInstances'
import { Pieces } from '../../lib/collections/Pieces'
import { RundownBaselineAdLibActions } from '../../lib/collections/RundownBaselineAdLibActions'
import { RundownBaselineAdLibPieces } from '../../lib/collections/RundownBaselineAdLibPieces'
import { RundownBaselineObjs } from '../../lib/collections/RundownBaselineObjs'
import { Segments } from '../../lib/collections/Segments'
import { ExpectedPackages } from '../../lib/collections/ExpectedPackages'

export async function removeRundownsFromDb(rundownIds: RundownId[]): Promise<void> {
	// Note: playlists are not removed by this, one could be left behind empty
	if (rundownIds.length > 0) {
		await Promise.allSettled([
			Rundowns.removeAsync({ _id: { $in: rundownIds } }),
			AdLibActions.removeAsync({ rundownId: { $in: rundownIds } }),
			AdLibPieces.removeAsync({ rundownId: { $in: rundownIds } }),
			ExpectedMediaItems.removeAsync({ rundownId: { $in: rundownIds } }),
			ExpectedPlayoutItems.removeAsync({ rundownId: { $in: rundownIds } }),
			ExpectedPackages.removeAsync({ rundownId: { $in: rundownIds } }),
			IngestDataCache.removeAsync({ rundownId: { $in: rundownIds } }),
			RundownBaselineAdLibPieces.removeAsync({ rundownId: { $in: rundownIds } }),
			Segments.removeAsync({ rundownId: { $in: rundownIds } }),
			Parts.removeAsync({ rundownId: { $in: rundownIds } }),
			PartInstances.removeAsync({ rundownId: { $in: rundownIds } }),
			Pieces.removeAsync({ startRundownId: { $in: rundownIds } }),
			PieceInstances.removeAsync({ rundownId: { $in: rundownIds } }),
			RundownBaselineAdLibActions.removeAsync({ rundownId: { $in: rundownIds } }),
			RundownBaselineObjs.removeAsync({ rundownId: { $in: rundownIds } }),
		])
	}
}
