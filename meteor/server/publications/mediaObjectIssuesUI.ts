import {
	PartId,
	PartInstanceId,
	PieceId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceGeneric } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { UIMediaObjectIssue } from '../../lib/api/rundownNotifications'
import { UIStudio } from '../../lib/api/studios'
import { DBPartInstance, PartInstances } from '../../lib/collections/PartInstances'
import { DBPart, Parts } from '../../lib/collections/Parts'
import { Pieces } from '../../lib/collections/Pieces'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { DBSegment, Segments } from '../../lib/collections/Segments'
import { ShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Studio, Studios } from '../../lib/collections/Studios'
import { groupByToMap, literal } from '../../lib/lib'
import { getBasicNotesForSegment } from '../../lib/rundownNotifications'
import { MongoQuery } from '../../lib/typings/meteor'
import {
	CustomPublishCollection,
	meteorCustomPublish,
	ReactiveMongoObserverGroup,
	setUpCollectionOptimizedObserver,
	TriggerUpdate,
} from '../lib/customPublication'
import { logger } from '../logging'
import { resolveCredentials } from '../security/lib/credentials'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { RundownReadAccess } from '../security/rundown'

interface UIMediaObjectIssuesArgs {
	// TODO - should this be for a whole playlist?
	readonly rundownId: RundownId
	// readonly playlistId: RundownPlaylistId
}

interface UIMediaObjectIssuesState {
	showStyleBaseId: ShowStyleBaseId
	studioId: StudioId

	sourceLayers: SourceLayers
	uiStudio: Pick<UIStudio, '_id' | 'settings' | 'packageContainers' | 'mappings' | 'routeSets'>

	segmentCache: Map<SegmentId, Pick<DBSegment, SegmentFields>>
	partsCache: Map<PartId, Pick<DBPart, PartFields>>
	piecesCache: Map<PieceId, Pick<PieceGeneric, PieceFields>>
}

interface UIMediaObjectIssuesUpdateProps {
	invalidateSourceLayers: boolean
	invalidateStudio: boolean
	invalidateRundown: boolean
	// invalidateRundownIds: RundownId[]
	invalidateSegmentIds: SegmentId[]
	invalidatePartIds: PartId[]
	invalidatePieceIds: PieceId[]
}

type RundownFields = '_id' | 'showStyleBaseId' | 'studioId'
const rundownFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownFields>>({
	_id: 1,
	showStyleBaseId: 1,
	studioId: 1,
})

type ShowStyleBaseFields = '_id' | 'sourceLayersWithOverrides'
const showStyleBaseFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<ShowStyleBaseFields>>({
	_id: 1,
	sourceLayersWithOverrides: 1,
})

type StudioFields = '_id' | 'settings' | 'packageContainers' | 'mappingsWithOverrides' | 'routeSets'
const studioFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<StudioFields>>({
	_id: 1,
	settings: 1,
	packageContainers: 1,
	mappingsWithOverrides: 1,
	routeSets: 1,
})

type SegmentFields = '_id' | '_rank' | 'name'
const segmentFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<SegmentFields>>({
	_id: 1,
	_rank: 1,
	name: 1,
})

type PartFields = '_id' | '_rank' | 'segmentId' | 'rundownId'
const partFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PartFields>>({
	_id: 1,
	_rank: 1,
	segmentId: 1,
	rundownId: 1,
})

type PieceFields = '_id' | 'name' | 'content' | 'expectedPackages'
const pieceFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PieceFields>>({
	_id: 1,
	name: 1,
	content: 1,
	expectedPackages: 1,
})

async function setupUIMediaObjectIssuesPublicationObservers(
	args: ReadonlyDeep<UIMediaObjectIssuesArgs>,
	triggerUpdate: TriggerUpdate<UIMediaObjectIssuesUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
	// const trackRundownChange = (id: RundownId): Partial<UIMediaObjectIssuesUpdateProps> => ({
	// 	invalidateRundownIds: [id],
	// })
	const trackSegmentChange = (id: SegmentId): Partial<UIMediaObjectIssuesUpdateProps> => ({
		invalidateSegmentIds: [id],
	})
	const trackPartChange = (id: PartId): Partial<UIMediaObjectIssuesUpdateProps> => ({
		invalidatePartIds: [id],
	})
	const trackPieceChange = (id: PieceId): Partial<UIMediaObjectIssuesUpdateProps> => ({
		invalidatePieceIds: [id],
	})

	// Second level of reactivity
	const rundownContentsObserver = ReactiveMongoObserverGroup(async () => {
		const rundown = (await Rundowns.findOneAsync(args.rundownId, { projection: rundownFieldSpecifier })) as
			| Pick<Rundown, RundownFields>
			| undefined

		if (rundown) {
			return [
				ShowStyleBases.find(rundown.showStyleBaseId, { fields: showStyleBaseFieldSpecifier }).observeChanges({
					added: () => triggerUpdate({ invalidateSourceLayers: true }),
					changed: () => triggerUpdate({ invalidateSourceLayers: true }),
					removed: () => triggerUpdate({ invalidateSourceLayers: true }),
				}),
				Studios.find(rundown.studioId, { fields: studioFieldSpecifier }).observeChanges({
					added: () => triggerUpdate({ invalidateStudio: true }),
					changed: () => triggerUpdate({ invalidateStudio: true }),
					removed: () => triggerUpdate({ invalidateStudio: true }),
				}),
			]
		} else {
			// Ensure cached data is cleared
			triggerUpdate({ invalidateSourceLayers: true })
			triggerUpdate({ invalidateStudio: true })

			return []
		}
	})

	// Set up observers:
	return [
		Rundowns.find({ _id: args.rundownId }, { fields: rundownFieldSpecifier }).observeChanges({
			added: () => {
				rundownContentsObserver.restart()
				// triggerUpdate(trackRundownChange(id))
				triggerUpdate({ invalidateRundown: true })
			},
			changed: () => {
				rundownContentsObserver.restart()
				// triggerUpdate(trackRundownChange(id))
				triggerUpdate({ invalidateRundown: true })
			},
			removed: () => {
				rundownContentsObserver.restart()
				// triggerUpdate(trackRundownChange(id))
				triggerUpdate({ invalidateRundown: true })
			},
		}),

		rundownContentsObserver,

		Segments.find({ rundownId: args.rundownId }, { fields: segmentFieldSpecifier }).observeChanges({
			added: (id) => triggerUpdate(trackSegmentChange(id)),
			changed: (id) => triggerUpdate(trackSegmentChange(id)),
			removed: (id) => triggerUpdate(trackSegmentChange(id)),
		}),
		Parts.find({ rundownId: args.rundownId }, { fields: partFieldSpecifier }).observeChanges({
			added: (id) => triggerUpdate(trackPartChange(id)),
			changed: (id) => triggerUpdate(trackPartChange(id)),
			removed: (id) => triggerUpdate(trackPartChange(id)),
		}),
		Pieces.find({ startRundownId: args.rundownId }, { fields: pieceFieldSpecifier }).observeChanges({
			added: (id) => triggerUpdate(trackPieceChange(id)),
			changed: (id) => triggerUpdate(trackPieceChange(id)),
			removed: (id) => triggerUpdate(trackPieceChange(id)),
		}),
	]
}

async function manipulateUIMediaObjectIssuesPublicationData(
	args: UIMediaObjectIssuesArgs,
	state: Partial<UIMediaObjectIssuesState>,
	_collection: CustomPublishCollection<UIMediaObjectIssue>,
	updateProps: Partial<ReadonlyDeep<UIMediaObjectIssuesUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	// Ensure the cached studio/showstyle id are updated
	const updateIds = !updateProps || updateProps.invalidateRundown
	if (updateIds) {
		const newIds = await updateIdsFromRundown(args)
		if (newIds) {
			state.showStyleBaseId = newIds[0]
			state.studioId = newIds[1]
		} else {
			state.showStyleBaseId = undefined
			state.studioId = undefined
		}
	}

	// Ensure the sourcelayers and studio are updated
	state.sourceLayers = await updateSourceLayers(
		state.showStyleBaseId,
		state.sourceLayers,
		updateIds || updateProps.invalidateSourceLayers
	)
	state.uiStudio = await updateStudio(state.studioId, state.uiStudio, updateIds || updateProps.invalidateStudio)

	// TODO
}

async function updateIdsFromRundown(args: UIMediaObjectIssuesArgs): Promise<[ShowStyleBaseId, StudioId] | undefined> {
	const rundown = (await Rundowns.findOneAsync(args.rundownId, { projection: rundownFieldSpecifier })) as
		| Pick<Rundown, RundownFields>
		| undefined

	if (!rundown) {
		return undefined
	}

	return [rundown.showStyleBaseId, rundown.studioId]
}

async function updateSourceLayers(
	showStyleBaseId: ShowStyleBaseId | undefined,
	existingSourceLayers: UIMediaObjectIssuesState['sourceLayers'] | undefined,
	invalidated: boolean | undefined
): Promise<UIMediaObjectIssuesState['sourceLayers'] | undefined> {
	if (!showStyleBaseId) return undefined

	if (!existingSourceLayers || invalidated) {
		const showStyleBase = (await ShowStyleBases.findOneAsync(showStyleBaseId, {
			projection: showStyleBaseFieldSpecifier,
		})) as Pick<ShowStyleBase, ShowStyleBaseFields> | undefined

		if (!showStyleBase) {
			return {}
		}

		return applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj
	}

	return existingSourceLayers
}

async function updateStudio(
	studioId: StudioId | undefined,
	existingStudio: UIMediaObjectIssuesState['uiStudio'] | undefined,
	invalidated: boolean | undefined
): Promise<UIMediaObjectIssuesState['uiStudio'] | undefined> {
	if (!studioId) return undefined

	if (!existingStudio || invalidated) {
		const studio = (await Studios.findOneAsync(studioId, {
			projection: studioFieldSpecifier,
		})) as Pick<Studio, StudioFields> | undefined

		if (!studio) {
			return undefined
		}

		return {
			_id: studio._id,
			settings: studio.settings,
			packageContainers: studio.packageContainers,
			mappings: applyAndValidateOverrides(studio.mappingsWithOverrides).obj,
			routeSets: studio.routeSets,
		}
	}

	return existingStudio
}

meteorCustomPublish(
	PubSub.uiMediaObjectIssues,
	CustomCollectionName.UIMediaObjectIssues,
	async function (pub, rundownId: RundownId | null) {
		const cred = await resolveCredentials({ userId: this.userId, token: undefined })

		if (
			rundownId &&
			(!cred || NoSecurityReadAccess.any() || (await RundownReadAccess.rundownContent(rundownId, cred)))
		) {
			await setUpCollectionOptimizedObserver<
				UIMediaObjectIssue,
				UIMediaObjectIssuesArgs,
				UIMediaObjectIssuesState,
				UIMediaObjectIssuesUpdateProps
			>(
				`pub_${PubSub.uiMediaObjectIssues}_${rundownId}`,
				{ rundownId },
				setupUIMediaObjectIssuesPublicationObservers,
				manipulateUIMediaObjectIssuesPublicationData,
				pub
			)
		} else {
			logger.warn(`Pub.${CustomCollectionName.UIMediaObjectIssues}: Not allowed: "${rundownId}"`)
		}
	}
)
