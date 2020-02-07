import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { check } from 'meteor/check'
import * as _ from 'underscore'
import { Rundowns } from '../collections/Rundowns'
import { Part } from '../collections/Parts'
import { ScriptContent } from 'tv-automation-sofie-blueprints-integration'
import { RundownPlaylist, RundownPlaylists } from '../collections/RundownPlaylists'

export enum PrompterMethods {
	getPrompterData = 'PrompterMethods.getPrompterData'
}

export interface PrompterDataLine {
	id: string
	text: string
	segmentId: string
	partId: string
}
export interface PrompterData {
	lines: Array<PrompterDataLine>
}

export namespace PrompterAPI {

	export function getPrompterData (playlistId: string): PrompterData {

		check(playlistId, String)

		let playlist = RundownPlaylists.findOne(playlistId)

		if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${playlistId}" not found!`)

		let parts = playlist.getParts({
			floated: {
				$ne: true
			}
		})

		let data: PrompterData = {
			lines: []
		}

		const piecesIncluded: string[] = []

		_.each(parts, (part: Part) => {
			let hasSentInThisLine = false

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
						data.lines.push({
							id: piece._id,
							text: content.fullScript,
							segmentId: part.segmentId,
							partId: part._id
						})
						hasSentInThisLine = true
					}

				}
			})
			if (!hasSentInThisLine) {
				// insert an empty line
				data.lines.push({
					id: Random.id(),
					text: '',
					segmentId: part.segmentId,
					partId: part._id
				})
			}
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
