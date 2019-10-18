import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import * as _ from 'underscore'
import { Rundowns } from '../collections/Rundowns'
import { Part } from '../collections/Parts'
import { ScriptContent } from 'tv-automation-sofie-blueprints-integration'

export enum PrompterMethods {
	getPrompterData = 'PrompterMethods.getPrompterData'
}

export interface PrompterDataLine {
	text: string
	segmentId: string
	partId: string
}
export interface PrompterData {
	lines: Array<PrompterDataLine>
}

export namespace PrompterAPI {

	export function getPrompterData (rundownId: string): PrompterData {

		check(rundownId, String)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		let parts = rundown.getParts()

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
