import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import * as _ from 'underscore'
import { Rundowns } from '../collections/Rundowns'
import { SegmentLine } from '../collections/SegmentLines'
import { ScriptContent } from 'tv-automation-sofie-blueprints-integration'

export enum PrompterMethods {
	getPrompterData = 'PrompterMethods.getPrompterData'
}

export interface PrompterDataLine {
	text: string
	segmentId: string
	segmentLineId: string
}
export interface PrompterData {
	lines: Array<PrompterDataLine>
}

export namespace PrompterAPI {

	export function getPrompterData (rundownId: string): PrompterData {

		check(rundownId, String)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		let segmentLines = rundown.getSegmentLines()

		let data: PrompterData = {
			lines: []
		}

		_.each(segmentLines, (sl: SegmentLine) => {
			let hasSentInThisLine = false

			_.each(sl.getAllPieces(), (piece) => {

				if (
					piece.content &&
					piece.content.fullScript
				) {
					const content = piece.content as ScriptContent
					if (content.fullScript) {
						data.lines.push({
							text: content.fullScript,
							segmentId: sl.segmentId,
							segmentLineId: sl._id
						})
						hasSentInThisLine = true
					}

				}
			})
			if (!hasSentInThisLine) {
				// insert an empty line
				data.lines.push({
					text: '',
					segmentId: sl.segmentId,
					segmentLineId: sl._id
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
