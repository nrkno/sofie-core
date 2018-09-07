import { Meteor } from 'meteor/meteor'
import { check, Match } from 'meteor/check'
import * as _ from 'underscore'
import { RunningOrders } from '../collections/RunningOrders'
import { SegmentLine } from '../collections/SegmentLines'
import { CachePrefix } from '../collections/RunningOrderDataCache'
import * as objectPath from 'object-path'
import { ScriptContent } from '../collections/SegmentLineItems'

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

	export function getPrompterData (roId: string): PrompterData {

		check(roId, String)

		let runningOrder = RunningOrders.findOne(roId)
		if (!runningOrder) throw new Meteor.Error(404, `RunningOrder "${roId}" not found!`)

		let segmentLines = runningOrder.getSegmentLines()

		let data: PrompterData = {
			lines: []
		}

		_.each(segmentLines, (sl: SegmentLine) => {

			_.each(sl.getSegmentLinesItems(), (sli) => {
				if (
					sli.content &&
					sli.content.fullScript
				) {
					const content = sli.content as ScriptContent

					if (content.fullScript) {
						data.lines.push({
							text: content.fullScript,
							segmentId: sl.segmentId,
							segmentLineId: sl._id
						})
					}
				}
			})
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
