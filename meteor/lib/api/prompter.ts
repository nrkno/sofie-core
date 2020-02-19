import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { check } from 'meteor/check'
import * as _ from 'underscore'
import { Rundowns } from '../collections/Rundowns'
import { Part } from '../collections/Parts'
import { ScriptContent } from 'tv-automation-sofie-blueprints-integration'
import { RundownPlaylist, RundownPlaylists } from '../collections/RundownPlaylists'
import { normalizeArray } from '../lib';

export enum PrompterMethods {
	getPrompterData = 'PrompterMethods.getPrompterData'
}

export interface PrompterDataSegment {
	id: string
	title: string | undefined
	parts: PrompterDataPart[]
}
export interface PrompterDataPart {
	id: string
	title: string | undefined
	lines: PrompterDataLine[]
}
export interface PrompterDataLine {
	id: string
	text: string
}
export interface PrompterData {
	title: string
	currentPartId: string | null
	nextPartId: string | null
	segments: Array<PrompterDataSegment>
}

export namespace PrompterAPI {

	export function getPrompterData (playlistId: string): PrompterData {

		check(playlistId, String)

		const playlist = RundownPlaylists.findOne(playlistId)
		if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${playlistId}" not found!`)

		const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()

		const { parts, segments } = playlist.getSegmentsAndPartsSync()
		// let parts = playlist.getAllOrderedParts().filter(p => !p.floated)
		const segmentsMap = normalizeArray(segments, '_id')
		const groupedParts = _.groupBy(parts, p => p.segmentId)

		let data: PrompterData = {
			title: playlist.name,
			currentPartId: currentPartInstance ? currentPartInstance.part._id : null,
			nextPartId: nextPartInstance ? nextPartInstance.part._id : null,
			segments: []
		}

		const piecesIncluded: string[] = []

		_.each(groupedParts, (parts, segmentId) => {
			const segment = segmentsMap[segmentId]
			if (segment && segment.isHidden) {
				// Skip if is hidden
				return
			}

			const segmentData: PrompterDataSegment = {
				id: segmentId,
				title: segment ? segment.name : undefined,
				parts: []
			}

			_.each(parts, part => {
				let title: string | undefined = part ? part.title : undefined
				if (part && part.typeVariant && part.typeVariant.toString && part.typeVariant.toString().toLowerCase().trim() === 'full') {
					title = 'FULL'
				}
				if (title) {
					title = title.replace(/.*;/, '') // DIREKTE PUNKT FESTIVAL;Split
				}

				const partData: PrompterDataPart = {
					id: part._id,
					title: title,
					lines: []
				}

				_.each(part.getAllPieces(), (piece) => {
					if (
						piece.content
					) {
						const content = piece.content as ScriptContent
						if (content.fullScript) {
							if (piecesIncluded.indexOf(piece.continuesRefId || piece._id) > 0) {
								return // piece already included in prompter script
							}
							piecesIncluded.push(piece.continuesRefId || piece._id)
							partData.lines.push({
								id: piece._id,
								text: content.fullScript
							})
						}
	
					}
				})
				if (partData.lines.length === 0) {
					// insert an empty line
					partData.lines.push({
						id: Random.id(),
						text: ''
					})
				}

				segmentData.parts.push(partData)
			})

			data.segments.push(segmentData)
		})
		return data
	}
}
let methods: any = {}
methods[PrompterMethods.getPrompterData] = PrompterAPI.getPrompterData
Meteor.methods(methods)

if (Meteor.isClient) {
	// @ts-ignore
	window.getPrompterData = PrompterAPI.getPrompterData
}
