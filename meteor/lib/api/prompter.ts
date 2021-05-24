import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { check } from '../../lib/check'
import * as _ from 'underscore'
import { Rundowns } from '../collections/Rundowns'
import { Part, PartId } from '../collections/Parts'
import { ScriptContent } from '@sofie-automation/blueprints-integration'
import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../collections/RundownPlaylists'
import { normalizeArray, protectString, unprotectString, getRandomId } from '../lib'
import { SegmentId } from '../collections/Segments'
import { PieceId } from '../collections/Pieces'

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
	id: PartId
	title: string | undefined
	pieces: PrompterDataPiece[]
}
export interface PrompterDataPiece {
	id: PieceId
	text: string
}
export interface PrompterData {
	title: string
	currentPartId: PartId | null
	nextPartId: PartId | null
	segments: Array<PrompterDataSegment>
}

export namespace PrompterAPI {
	// TODO: discuss: move this implementation to server-side?
	export function getPrompterData(playlistId: RundownPlaylistId): PrompterData {
		check(playlistId, String)

		const playlist = RundownPlaylists.findOne(playlistId)
		if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${playlistId}" not found!`)

		const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()

		const { parts, segments } = playlist.getSegmentsAndPartsSync()
		// let parts = playlist.getAllOrderedParts().filter(p => !p.floated)
		const segmentsMap = normalizeArray(segments, '_id')
		const groupedParts = _.groupBy(parts, (p) => p.segmentId)

		const data: PrompterData = {
			title: playlist.name,
			currentPartId: currentPartInstance ? currentPartInstance.part._id : null,
			nextPartId: nextPartInstance ? nextPartInstance.part._id : null,
			segments: [],
		}

		const piecesIncluded: PieceId[] = []

		Object.entries(groupedParts).forEach(([segmentId, parts]) => {
			const segment = segmentsMap[segmentId]
			if (segment && segment.isHidden) {
				// Skip if is hidden
				return
			}

			const segmentData: PrompterDataSegment = {
				id: protectString(segmentId),
				title: segment ? segment.name : undefined,
				parts: [],
			}

			for (const part of parts) {
				const partData: PrompterDataPart = {
					id: part._id,
					title: part.title,
					pieces: [],
				}

				const allPieces = part.getAllPieces()

				for (const piece of allPieces) {
					if (piece.content) {
						const content = piece.content as ScriptContent
						if (content.fullScript) {
							if (piecesIncluded.indexOf(piece.continuesRefId || piece._id) > 0) {
								return // piece already included in prompter script
							}
							piecesIncluded.push(piece.continuesRefId || piece._id)
							partData.pieces.push({
								id: piece._id,
								text: content.fullScript,
							})
						}
					}
				}

				if (partData.pieces.length === 0) {
					// insert an empty line
					partData.pieces.push({
						id: getRandomId(),
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

if (Meteor.isClient) {
	// @ts-ignore
	window.getPrompterData = PrompterAPI.getPrompterData
}
