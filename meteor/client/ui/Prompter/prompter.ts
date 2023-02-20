import { check } from '../../../lib/check'
import * as _ from 'underscore'
import { ScriptContent, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { normalizeArrayToMap, protectString } from '../../../lib/lib'
import { Piece } from '../../../lib/collections/Pieces'
import { getPieceInstancesForPartInstance, getSegmentsWithPartInstances } from '../../../lib/Rundown'
import { FindOptions } from '../../../lib/collections/lib'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { Rundown } from '../../../lib/collections/Rundowns'
import { processAndPrunePieceInstanceTimings } from '@sofie-automation/corelib/dist/playout/infinites'
import { UIShowStyleBases } from '../Collections'
import {
	PartId,
	PartInstanceId,
	PieceId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylists, PieceInstances, Pieces } from '../../collections'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { RundownPlaylistCollectionUtil } from '../../../lib/collections/rundownPlaylistUtil'

// export interface NewPrompterAPI {
// 	getPrompterData (playlistId: RundownPlaylistId): Promise<PrompterData>
// }
// export enum PrompterAPIMethods {
// 	'getPrompterData' = 'PrompterMethods.getPrompterData'
// }

export interface PrompterDataSegment {
	id: SegmentId
	title: string | undefined
	parts: PrompterDataPart[]
}
export interface PrompterDataPart {
	id: PartInstanceId
	title: string | undefined
	pieces: PrompterDataPiece[]
}
export interface PrompterDataPiece {
	id: PieceId
	text: string
}
export interface PrompterData {
	title: string
	currentPartInstanceId: PartInstanceId | null
	nextPartInstanceId: PartInstanceId | null
	segments: Array<PrompterDataSegment>
}

export namespace PrompterAPI {
	// TODO: discuss: move this implementation to server-side?
	export function getPrompterData(playlistId: RundownPlaylistId): PrompterData | null {
		check(playlistId, String)

		const playlist = RundownPlaylists.findOne(playlistId)

		if (!playlist) {
			return null
		}
		const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)
		const rundownIdsToSourceLayers: Map<RundownId, ShowStyleBaseId> = new Map()
		const rundownIdsToShowStyleBase: Map<RundownId, SourceLayers | undefined> = new Map()
		for (const rundown of rundowns) {
			rundownIdsToSourceLayers.set(rundown._id, rundown.showStyleBaseId)
			const showStyleBase = UIShowStyleBases.findOne(rundown.showStyleBaseId)
			const sourceLayers = showStyleBase?.sourceLayers
			rundownIdsToShowStyleBase.set(rundown._id, sourceLayers)
		}
		const rundownMap = normalizeArrayToMap(rundowns, '_id')

		const { currentPartInstance, nextPartInstance } =
			RundownPlaylistCollectionUtil.getSelectedPartInstances(playlist)

		const groupedParts = getSegmentsWithPartInstances(
			playlist,
			undefined,
			undefined,
			// unless this is the current or next PartInstance, we actually don't want the PartInstances,
			// we want it to behave as if all other PartInstances are reset.
			{
				_id: {
					$in: [currentPartInstance?._id, nextPartInstance?._id].filter(Boolean) as PartInstanceId[],
				},
			},
			undefined,
			undefined,
			{
				fields: {
					isTaken: 0,
					previousPartEndState: 0,
					takeCount: 0,
					timings: 0,
				},
			}
		)

		// const groupedParts = _.groupBy(parts, (p) => p.segmentId)

		const data: PrompterData = {
			title: playlist.name,
			currentPartInstanceId: currentPartInstance ? currentPartInstance._id : null,
			nextPartInstanceId: nextPartInstance ? nextPartInstance._id : null,
			segments: [],
		}

		const piecesIncluded: PieceId[] = []
		const segmentIds: SegmentId[] = groupedParts.map(({ segment }) => segment._id)
		const orderedAllPartIds: PartId[] = _.flatten(
			groupedParts.map(({ partInstances }) => partInstances.map((partInstance) => partInstance.part._id))
		)

		let nextPartIsAfterCurrentPart = false
		if (nextPartInstance && currentPartInstance) {
			if (nextPartInstance.segmentId === currentPartInstance.segmentId) {
				nextPartIsAfterCurrentPart = currentPartInstance.part._rank < nextPartInstance.part._rank
			} else {
				const nextPartSegmentIndex = segmentIds.indexOf(nextPartInstance.segmentId)
				const currentPartSegmentIndex = segmentIds.indexOf(currentPartInstance.segmentId)
				if (nextPartSegmentIndex >= 0 && currentPartSegmentIndex >= 0) {
					nextPartIsAfterCurrentPart = currentPartSegmentIndex < nextPartSegmentIndex
				}
			}
		}

		let currentRundownIndex = 0
		let previousRundown: Rundown | null = null
		const rundownIds = rundowns.map((rundown) => rundown._id)

		const allPiecesCache = new Map<PartId, Piece[]>()
		Pieces.find({
			startRundownId: { $in: rundownIds },
		}).forEach((piece) => {
			let pieces = allPiecesCache.get(piece.startPartId)
			if (!pieces) {
				pieces = []
				allPiecesCache.set(piece.startPartId, pieces)
			}
			pieces?.push(piece)
		})

		const pieceInstanceFieldOptions: FindOptions<PieceInstance> = {
			fields: {
				plannedStartedPlayback: 0,
				plannedStoppedPlayback: 0,
				reportedStartedPlayback: 0,
				reportedStoppedPlayback: 0,
				userDuration: 0,
			},
		}

		const currentPartInstancePieceInstances = currentPartInstance
			? PieceInstances.find(
					{
						partInstanceId: currentPartInstance._id,
					},
					pieceInstanceFieldOptions
			  ).fetch()
			: undefined

		groupedParts.forEach(({ segment, partInstances }, segmentIndex) => {
			const segmentId = segment._id
			const rundown = rundownMap.get(segment.rundownId)
			if (rundown && rundown !== previousRundown) {
				currentRundownIndex = rundowns.indexOf(rundown)
				previousRundown = rundown
			}
			if ((segment && segment.isHidden) || !rundown) {
				// Skip if is hidden or rundown not found
				return
			}

			const segmentData: PrompterDataSegment = {
				id: segmentId,
				title: segment ? segment.name : undefined,
				parts: [],
			}

			const partIds = partInstances.map((part) => part.part._id)

			for (let partIndex = 0; partIndex < partInstances.length; partIndex++) {
				const partInstance = partInstances[partIndex]
				const partData: PrompterDataPart = {
					id: partInstance._id,
					title: partInstance.part.title,
					pieces: [],
				}

				const rawPieceInstances = getPieceInstancesForPartInstance(
					playlist.activationId,
					rundown,
					partInstance,
					new Set(partIds.slice(0, partIndex)),
					new Set(segmentIds.slice(0, segmentIndex)),
					rundownIds.slice(0, currentRundownIndex),
					rundownIdsToSourceLayers,
					orderedAllPartIds,
					nextPartIsAfterCurrentPart,
					currentPartInstance,
					currentPartInstancePieceInstances,
					allPiecesCache,
					pieceInstanceFieldOptions,
					true
				)

				const sourceLayers = rundownIdsToShowStyleBase.get(partInstance.rundownId)
				if (sourceLayers) {
					const preprocessedPieces = processAndPrunePieceInstanceTimings(
						sourceLayers,
						rawPieceInstances,
						0,
						true
					)

					for (const pieceInstance of preprocessedPieces) {
						const piece = pieceInstance.piece
						const sourceLayer = sourceLayers[piece.sourceLayerId]

						if (piece.content && sourceLayer && sourceLayer.type === SourceLayerType.SCRIPT) {
							const content = piece.content as ScriptContent
							if (content.fullScript) {
								if (piecesIncluded.indexOf(piece.continuesRefId || piece._id) >= 0) {
									break // piece already included in prompter script
								}
								piecesIncluded.push(piece.continuesRefId || piece._id)
								partData.pieces.push({
									id: piece._id,
									text: content.fullScript,
								})
							}
						}
					}
				}

				if (partData.pieces.length === 0) {
					// insert an empty line
					partData.pieces.push({
						id: protectString(`part_${partData.id}_empty`),
						text: '',
					})
				}

				segmentData.parts.push(partData)
			}

			data.segments.push(segmentData)
		})
		return data
	}
}
