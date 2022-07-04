import {
	IAdLibFilterLink,
	IBlueprintActionManifestDisplayContent,
	IGUIContextFilterLink,
	IOutputLayer,
	IRundownPlaylistFilterLink,
	ISourceLayer,
	ITranslatableMessage,
	PieceLifespan,
} from '@sofie-automation/blueprints-integration'
import { AdLibAction, AdLibActions } from '../../collections/AdLibActions'
import { AdLibPiece, AdLibPieces } from '../../collections/AdLibPieces'
import { DBPart, PartId, Parts } from '../../collections/Parts'
import { RundownBaselineAdLibAction, RundownBaselineAdLibActions } from '../../collections/RundownBaselineAdLibActions'
import { RundownBaselineAdLibItem, RundownBaselineAdLibPieces } from '../../collections/RundownBaselineAdLibPieces'
import { DBRundownPlaylist, RundownPlaylist, RundownPlaylists } from '../../collections/RundownPlaylists'
import { ShowStyleBase } from '../../collections/ShowStyleBases'
import { StudioId } from '../../collections/Studios'
import { assertNever, generateTranslation } from '../../lib'
import { FindOptions, MongoSelector } from '../../typings/meteor'
import { DBRundown, RundownId, Rundowns } from '../../collections/Rundowns'
import { memoizedIsolatedAutorun } from '../../../client/lib/reactiveData/reactiveDataHelper'
import { DBSegment, Segments, SegmentId } from '../../collections/Segments'
import { sortAdlibs } from '../../Rundown'
import { ReactivePlaylistActionContext } from './actionFactory'

export type AdLibFilterChainLink = IRundownPlaylistFilterLink | IGUIContextFilterLink | IAdLibFilterLink

/** This is a compiled Filter type, targetting a particular MongoCollection */
type CompiledFilter<T> = {
	selector: MongoSelector<T>
	options: FindOptions<T>
	pick: number | undefined
	limit: number | undefined
	global: boolean | undefined
	segment: 'current' | 'next' | undefined
	part: 'current' | 'next' | undefined
	arguments?: {
		triggerMode: string
	}
	/**
	 * The query compiler has determined that this filter will always return an empty set,
	 * it's safe to skip it entirely.
	 */
	skip?: true
}

type SomeAdLib = RundownBaselineAdLibItem | RundownBaselineAdLibAction | AdLibPiece | AdLibAction

interface IWrappedAdLibType<T extends SomeAdLib, typeName extends string> {
	_id: T['_id']
	_rank: number
	partId: PartId | null
	type: typeName
	label: string | ITranslatableMessage
	sourceLayerId?: ISourceLayer['_id']
	outputLayerId?: IOutputLayer['_id']
	expectedDuration?: number | PieceLifespan
	item: T
}

/** What follows are utility functions to wrap various AdLib objects to IWrappedAdLib */

function wrapAdLibAction(adLib: AdLibAction, type: 'adLibAction'): IWrappedAdLib {
	return {
		_id: adLib._id,
		_rank: adLib.display?._rank || 0,
		partId: adLib.partId,
		type: type,
		label: adLib.display.label,
		sourceLayerId: (adLib.display as IBlueprintActionManifestDisplayContent).sourceLayerId,
		outputLayerId: (adLib.display as IBlueprintActionManifestDisplayContent).outputLayerId,
		expectedDuration: undefined,
		item: adLib,
	}
}

function wrapRundownBaselineAdLibAction(
	adLib: RundownBaselineAdLibAction,
	type: 'rundownBaselineAdLibAction'
): IWrappedAdLib {
	return {
		_id: adLib._id,
		_rank: adLib.display?._rank ?? 0,
		partId: adLib.partId ?? null,
		type: type,
		label: adLib.display.label,
		sourceLayerId: (adLib.display as IBlueprintActionManifestDisplayContent).sourceLayerId,
		outputLayerId: (adLib.display as IBlueprintActionManifestDisplayContent).outputLayerId,
		expectedDuration: undefined,
		item: adLib,
	}
}

function wrapAdLibPiece<T extends RundownBaselineAdLibItem | AdLibPiece>(
	adLib: T,
	type: 'adLibPiece' | 'rundownBaselineAdLibItem'
): IWrappedAdLib {
	return {
		_id: adLib._id,
		_rank: adLib._rank,
		partId: adLib.partId ?? null,
		type: type,
		label: adLib.name,
		sourceLayerId: adLib.sourceLayerId,
		outputLayerId: adLib.outputLayerId,
		expectedDuration: adLib.expectedDuration || adLib.lifespan,
		item: adLib,
	}
}

export type IWrappedAdLib =
	| IWrappedAdLibType<RundownBaselineAdLibItem, 'rundownBaselineAdLibItem'>
	| IWrappedAdLibType<RundownBaselineAdLibAction, 'rundownBaselineAdLibAction'>
	| IWrappedAdLibType<AdLibPiece, 'adLibPiece'>
	| IWrappedAdLibType<AdLibAction, 'adLibAction'>
	| {
			_id: ISourceLayer['_id']
			_rank: number
			partId: PartId | null
			type: 'clearSourceLayer'
			label: string | ITranslatableMessage
			sourceLayerId: ISourceLayer['_id']
			outputLayerId: undefined
			expectedDuration: undefined
			item: ISourceLayer
	  }
	| {
			_id: ISourceLayer['_id']
			_rank: number
			partId: PartId | null
			type: 'sticky'
			label: string | ITranslatableMessage
			sourceLayerId: ISourceLayer['_id']
			outputLayerId: undefined
			expectedDuration: undefined
			item: ISourceLayer
	  }

/** What follows are methods to compile a filterChain to a CompiledFilter (a MongoSelector with options and some
 * additional flags, used for performance optimization ) */

function sharedSourceLayerFilterCompiler(
	filterChain: IAdLibFilterLink[],
	showStyleBase: ShowStyleBase,
	targetType: 'clear' | 'sticky'
): {
	global: boolean | undefined
	skip: true | undefined
	sourceLayerIds: string[] | undefined
} {
	let global: boolean | undefined = undefined
	let skip: true | undefined = undefined
	let sourceLayerIds: string[] | undefined = undefined

	filterChain.forEach((link) => {
		switch (link.field) {
			case 'global':
				global = link.value
				if (global === false) {
					skip = true
				}
				return
			case 'label':
				// skip this filter, we assume clear ad-libs have no labels for the purpose of the triggers
				skip = true
				return
			case 'outputLayerId':
				// skip this filter, we assume clear ad-libs have no output layers for the purpose of the triggers
				skip = true
				return
			case 'sourceLayerId':
				sourceLayerIds = link.value
				return
			case 'sourceLayerType':
				sourceLayerIds = showStyleBase.sourceLayers
					.map((sourceLayer) => (link.value.includes(sourceLayer.type) ? sourceLayer._id : undefined))
					.filter(Boolean) as string[]
				return
			case 'segment':
				// skip this filter, clear adlibs are global
				skip = true
				return
			case 'part':
				// skip this filter, clear adlibs are global
				skip = true
				return
			case 'tag':
				// skip this filter, clear adlibs have no tags
				skip = true
				return
			case 'type':
				if (link.value !== targetType) {
					skip = true
				}
				return
			case 'limit':
				// we can skip the limit stage here, it's going to be done at the final step anyway and
				// it doesn't speed anything up
				return
			case 'pick':
				// we can skip the pick stage here, it's done later anyway
				return
			case 'pickEnd':
				// we can skip the pick stage here, it's done later anyway
				return
			default:
				assertNever(link)
				return
		}
	})

	return {
		global,
		skip,
		sourceLayerIds,
	}
}

function compileAndRunClearFilter(filterChain: IAdLibFilterLink[], showStyleBase: ShowStyleBase): IWrappedAdLib[] {
	const { skip, sourceLayerIds } = sharedSourceLayerFilterCompiler(filterChain, showStyleBase, 'clear')

	let result: IWrappedAdLib[] = []

	if (!skip) {
		result = showStyleBase.sourceLayers
			.filter(
				(sourceLayer) =>
					(sourceLayerIds ? sourceLayerIds.includes(sourceLayer._id) : true) && sourceLayer.isClearable
			)
			.map((sourceLayer) => {
				return {
					_id: sourceLayer._id,
					_rank: sourceLayer._rank,
					item: sourceLayer,
					type: 'clearSourceLayer',
					sourceLayerId: sourceLayer._id,
					label: generateTranslation('Clear {{layerName}}', { layerName: sourceLayer.name }),
					expectedDuration: undefined,
					outputLayerId: undefined,
				} as IWrappedAdLib
			})
			.sort((a, b) => a._rank - b._rank)
	}

	return result
}

function compileAndRunStickyFilter(filterChain: IAdLibFilterLink[], showStyleBase: ShowStyleBase): IWrappedAdLib[] {
	const { skip, sourceLayerIds } = sharedSourceLayerFilterCompiler(filterChain, showStyleBase, 'sticky')

	let result: IWrappedAdLib[] = []

	if (!skip) {
		result = showStyleBase.sourceLayers
			.filter(
				(sourceLayer) =>
					(sourceLayerIds ? sourceLayerIds.includes(sourceLayer._id) : true) && sourceLayer.isSticky === true
			)
			.map((sourceLayer) => {
				return {
					_id: sourceLayer._id,
					_rank: sourceLayer._rank,
					item: sourceLayer,
					type: 'sticky',
					sourceLayerId: sourceLayer._id,
					label: generateTranslation('Last {{layerName}}', { layerName: sourceLayer.name }),
					expectedDuration: undefined,
					outputLayerId: undefined,
				} as IWrappedAdLib
			})
			.sort((a, b) => a._rank - b._rank)
	}

	return result
}

type AdLibActionType = RundownBaselineAdLibAction | AdLibAction

function compileAdLibActionFilter(
	filterChain: IAdLibFilterLink[],
	showStyleBase: ShowStyleBase
): CompiledFilter<AdLibActionType> {
	const selector: MongoSelector<AdLibActionType> = {}
	const options: FindOptions<AdLibActionType> = {}
	let pick: number | undefined = undefined
	let limit: number | undefined = undefined
	let global: boolean | undefined = undefined
	let skip: true | undefined = undefined
	let segment: 'current' | 'next' | undefined = undefined
	let part: 'current' | 'next' | undefined = undefined

	filterChain.forEach((link) => {
		switch (link.field) {
			case 'global':
				selector['partId'] = {
					$exists: !link.value,
				}
				global = link.value
				return
			case 'label':
				selector['display.label.key'] = {
					$regex: Array.isArray(link.value) ? link.value.join('|') : link.value,
				}
				return
			case 'outputLayerId':
				selector['display.outputLayerId'] = {
					$in: link.value,
				}
				return
			case 'sourceLayerId':
				selector['display.sourceLayerId'] = {
					$in: link.value,
				}
				return
			case 'sourceLayerType':
				selector['display.sourceLayerId'] = {
					$in: showStyleBase.sourceLayers
						.map((sourceLayer) => (link.value.includes(sourceLayer.type) ? sourceLayer._id : undefined))
						.filter(Boolean) as string[],
				}
				return
			case 'segment':
				if (global) {
					skip = true
				}
				segment = link.value
				return
			case 'part':
				if (global) {
					skip = true
				}
				part = link.value
				return
			case 'tag':
				selector['display.tags'] = {
					$all: link.value,
				}
				return
			case 'type':
				if (link.value !== 'adLibAction') {
					skip = true
				}
				return
			case 'limit':
				limit = link.value
				return
			case 'pick':
				pick = link.value
				return
			case 'pickEnd':
				pick = (link.value + 1) * -1
				return
			default:
				assertNever(link)
				return
		}
	})

	return {
		selector,
		options,
		global,
		segment,
		part,
		limit,
		pick,
		skip,
	}
}

type AdLibPieceType = RundownBaselineAdLibItem | AdLibPiece

function compileAdLibPieceFilter(
	filterChain: IAdLibFilterLink[],
	showStyleBase: ShowStyleBase
): CompiledFilter<AdLibPieceType> {
	const selector: MongoSelector<AdLibPieceType> = {}
	const options: FindOptions<AdLibPieceType> = {}
	let pick: number | undefined = undefined
	let limit: number | undefined = undefined
	let global: boolean | undefined = undefined
	let skip: true | undefined = undefined
	let segment: 'current' | 'next' | undefined = undefined
	let part: 'current' | 'next' | undefined = undefined

	filterChain.forEach((link) => {
		switch (link.field) {
			case 'global':
				selector['partId'] = {
					$exists: !link.value,
				}
				global = link.value
				return
			case 'label':
				selector['name'] = {
					$regex: Array.isArray(link.value) ? link.value.join('|') : link.value,
				}
				return
			case 'outputLayerId':
				selector['outputLayerId'] = {
					$in: link.value,
				}
				return
			case 'sourceLayerId':
				selector['sourceLayerId'] = {
					$in: link.value,
				}
				return
			case 'sourceLayerType':
				selector['sourceLayerId'] = {
					$in: showStyleBase.sourceLayers
						.map((sourceLayer) => (link.value.includes(sourceLayer.type) ? sourceLayer._id : undefined))
						.filter(Boolean) as string[],
				}
				return
			case 'segment':
				if (global) {
					skip = true
				}
				segment = link.value
				return
			case 'part':
				if (global) {
					skip = true
				}
				part = link.value
				return
			case 'tag':
				selector['tags'] = {
					$all: link.value,
				}
				return
			case 'type':
				if (link.value !== 'adLib') {
					skip = true
				}
				return
			case 'limit':
				limit = link.value
				return
			case 'pick':
				pick = link.value
				return
			case 'pickEnd':
				pick = (link.value + 1) * -1
				return
			default:
				assertNever(link)
				return
		}
	})

	return {
		selector,
		options,
		global,
		segment,
		part,
		limit,
		pick,
		skip,
	}
}

/**
 * Compile the filter chain and return a reactive function that will return the result set for this adLib filter
 * @param filterChain
 * @param showStyleBase
 * @returns
 */
export function compileAdLibFilter(
	filterChain: AdLibFilterChainLink[],
	showStyleBase: ShowStyleBase
): (context: ReactivePlaylistActionContext) => IWrappedAdLib[] {
	const onlyAdLibLinks = filterChain.filter((link) => link.object === 'adLib') as IAdLibFilterLink[]
	const adLibPieceTypeFilter = compileAdLibPieceFilter(onlyAdLibLinks, showStyleBase)
	const adLibActionTypeFilter = compileAdLibActionFilter(onlyAdLibLinks, showStyleBase)

	const clearAdLibs = compileAndRunClearFilter(onlyAdLibLinks, showStyleBase)
	const stickyAdLibs = compileAndRunStickyFilter(onlyAdLibLinks, showStyleBase)

	return (context: ReactivePlaylistActionContext) => {
		let rundownBaselineAdLibItems: IWrappedAdLib[] = []
		let adLibPieces: IWrappedAdLib[] = []
		let rundownBaselineAdLibActions: IWrappedAdLib[] = []
		let adLibActions: IWrappedAdLib[] = []
		const segmentPartIds =
			adLibPieceTypeFilter.segment === 'current'
				? context.currentSegmentPartIds.get()
				: adLibPieceTypeFilter.segment === 'next'
				? context.nextSegmentPartIds.get()
				: undefined

		const singlePartId =
			adLibPieceTypeFilter.part === 'current'
				? context.currentPartId.get()
				: adLibPieceTypeFilter.part === 'next'
				? context.nextPartId.get()
				: undefined

		/** Note: undefined means that all parts are to be considered */
		let partFilter: PartId[] | undefined = undefined

		// Figure out the intersection of the segment current/next filter
		// and the part current/next filter.
		// It is possible to say "only from current segment" & "only from next part"
		// with the result being empty, if the the next part is in another segment
		if (segmentPartIds === undefined && singlePartId !== undefined) {
			if (singlePartId !== null) {
				partFilter = [singlePartId]
			} else {
				partFilter = []
			}
		} else if (segmentPartIds !== undefined && singlePartId === undefined) {
			partFilter = segmentPartIds
		} else if (segmentPartIds !== undefined && singlePartId !== undefined) {
			if (singlePartId !== null && segmentPartIds.includes(singlePartId)) {
				partFilter = [singlePartId]
			} else {
				partFilter = []
			}
		}

		{
			let skip = adLibPieceTypeFilter.skip
			const currentNextOverride: MongoSelector<AdLibPieceType> = {}

			if (partFilter) {
				if (partFilter.length === 0) {
					skip = true
				} else {
					currentNextOverride['partId'] = {
						$in: partFilter,
					}
				}
			}

			const currentRundownId = context.currentRundownId.get()
			if (!skip && currentRundownId) {
				if (adLibPieceTypeFilter.global === undefined || adLibPieceTypeFilter.global === true)
					rundownBaselineAdLibItems = RundownBaselineAdLibPieces.find(
						{
							...adLibPieceTypeFilter.selector,
							...currentNextOverride,
							rundownId: currentRundownId,
						} as MongoSelector<RundownBaselineAdLibItem>,
						adLibPieceTypeFilter.options
					).map((item) => wrapAdLibPiece(item, 'rundownBaselineAdLibItem'))
				if (adLibPieceTypeFilter.global === undefined || adLibPieceTypeFilter.global === false)
					adLibPieces = AdLibPieces.find(
						{
							...adLibPieceTypeFilter.selector,
							...currentNextOverride,
							rundownId: currentRundownId,
						} as MongoSelector<AdLibPiece>,
						adLibPieceTypeFilter.options
					).map((item) => wrapAdLibPiece(item, 'adLibPiece'))
			}
		}

		{
			let skip = adLibActionTypeFilter.skip
			const currentNextOverride: MongoSelector<AdLibActionType> = {}

			if (partFilter) {
				if (partFilter.length === 0) {
					skip = true
				} else {
					currentNextOverride['partId'] = {
						$in: partFilter,
					}
				}
			}

			const currentRundownId = context.currentRundownId.get()
			if (!skip && currentRundownId) {
				if (adLibActionTypeFilter.global === undefined || adLibActionTypeFilter.global === true)
					rundownBaselineAdLibActions = RundownBaselineAdLibActions.find(
						{
							...adLibActionTypeFilter.selector,
							...currentNextOverride,
							rundownId: currentRundownId,
						} as MongoSelector<RundownBaselineAdLibAction>,
						adLibActionTypeFilter.options
					).map((item) => wrapRundownBaselineAdLibAction(item, 'rundownBaselineAdLibAction'))
				if (adLibActionTypeFilter.global === undefined || adLibActionTypeFilter.global === false)
					adLibActions = AdLibActions.find(
						{
							...adLibActionTypeFilter.selector,
							...currentNextOverride,
							rundownId: currentRundownId,
						} as MongoSelector<AdLibAction>,
						adLibActionTypeFilter.options
					).map((item) => wrapAdLibAction(item, 'adLibAction'))
			}
		}

		const rundownRankMap = new Map<RundownId, number>()
		const segmentRankMap = new Map<SegmentId, number>()
		const partRankMap = new Map<PartId, { segmentId: SegmentId; _rank: number; rundownId: RundownId }>()
		{
			if (partFilter === undefined || partFilter.length > 0) {
				// Note: We need to return an array from within memoizedIsolatedAutorun,
				// because _.isEqual (used in memoizedIsolatedAutorun) doesn't work with Maps..

				const rundownPlaylistId = context.rundownPlaylistId.get()
				const rundownRanks = memoizedIsolatedAutorun(() => {
					const playlist = RundownPlaylists.findOne(rundownPlaylistId, {
						projection: {
							rundownIdsInOrder: 1,
						},
					}) as Pick<DBRundownPlaylist, 'rundownIdsInOrder'> | undefined

					if (playlist?.rundownIdsInOrder) {
						return playlist.rundownIdsInOrder
					} else {
						const rundowns = Rundowns.find(
							{
								playlistId: rundownPlaylistId,
							},
							{
								fields: {
									_id: 1,
								},
							}
						).fetch() as Pick<DBRundown, '_id'>[]

						return rundowns.map((r) => r._id)
					}
				}, `rundownsRanksForPlaylist_${rundownPlaylistId}`)
				rundownRanks.forEach((id, index) => {
					rundownRankMap.set(id, index)
				})

				const segmentRanks = memoizedIsolatedAutorun(
					() =>
						Segments.find(
							{
								rundownId: { $in: Array.from(rundownRankMap.keys()) },
							},
							{
								fields: {
									_id: 1,
									_rank: 1,
								},
							}
						).fetch() as Pick<DBSegment, '_id' | '_rank'>[],
					`segmentRanksForRundowns_${Array.from(rundownRankMap.keys()).join(',')}`
				)
				segmentRanks.forEach((segment) => {
					segmentRankMap.set(segment._id, segment._rank)
				})

				const partRanks = memoizedIsolatedAutorun(() => {
					if (!partFilter) {
						return Parts.find(
							{
								rundownId: { $in: Array.from(rundownRankMap.keys()) },
							},
							{
								fields: {
									_id: 1,
									segmentId: 1,
									rundownId: 1,
									_rank: 1,
								},
							}
						).fetch() as Pick<DBPart, '_id' | '_rank' | 'segmentId' | 'rundownId'>[]
					} else {
						return Parts.find(
							{ _id: { $in: partFilter } },
							{
								fields: {
									_id: 1,
									segmentId: 1,
									rundownId: 1,
									_rank: 1,
								},
							}
						).fetch() as Pick<DBPart, '_id' | '_rank' | 'segmentId' | 'rundownId'>[]
					}
				}, `partRanks_${JSON.stringify(partFilter ?? rundownRankMap.keys())}`)

				partRanks.forEach((part) => {
					partRankMap.set(part._id, part)
				})
			}
		}

		let resultingAdLibs: IWrappedAdLib[] = []

		{
			resultingAdLibs = [
				...rundownBaselineAdLibItems,
				...rundownBaselineAdLibActions,
				...adLibPieces,
				...adLibActions,
				...clearAdLibs,
				...stickyAdLibs,
			]

			// Sort the adliba:
			resultingAdLibs = sortAdlibs(
				resultingAdLibs.map((adlib) => {
					const part = adlib.partId && partRankMap.get(adlib.partId)
					const segmentRank = part?.segmentId && segmentRankMap.get(part.segmentId)
					const rundownRank = part?.rundownId && rundownRankMap.get(part.rundownId)

					return {
						adlib: adlib,
						label: adlib.label,
						adlibRank: adlib._rank,
						adlibId: adlib._id,
						partRank: part?._rank ?? null,
						segmentRank: segmentRank ?? null,
						rundownRank: rundownRank ?? null,
					}
				})
			)

			// finalize the process: apply limit and pick
			if (adLibPieceTypeFilter.limit !== undefined) {
				resultingAdLibs = resultingAdLibs.slice(0, adLibPieceTypeFilter.limit)
			}
			if (adLibPieceTypeFilter.pick !== undefined && adLibPieceTypeFilter.pick >= 0) {
				resultingAdLibs = [resultingAdLibs[adLibPieceTypeFilter.pick]]
			} else if (adLibPieceTypeFilter.pick !== undefined && adLibPieceTypeFilter.pick < 0) {
				resultingAdLibs = [resultingAdLibs[resultingAdLibs.length + adLibPieceTypeFilter.pick]]
			}
		}

		// remove any falsy values from the result set
		return resultingAdLibs.filter(Boolean)
	}
}

export function rundownPlaylistFilter(
	studioId: StudioId,
	filterChain: IRundownPlaylistFilterLink[]
): RundownPlaylist | undefined {
	const selector: MongoSelector<DBRundownPlaylist> = {
		$and: [
			{
				studioId,
			},
		],
	}

	filterChain.forEach((link) => {
		switch (link.field) {
			case 'activationId':
				selector['activationId'] = {
					$exists: link.value,
				}
				break
			case 'name':
				selector['name'] = {
					$regex: link.value,
				}
				break
			case 'studioId':
				selector['$and']?.push({
					studioId: {
						$regex: link.value,
					},
				})
				break
			default:
				assertNever(link)
				break
		}
	})

	return RundownPlaylists.findOne(selector)
}
