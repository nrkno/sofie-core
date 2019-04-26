import { Tracker } from 'meteor/tracker'
import { ReactiveDataHelper } from './reactiveDataHelper'
import { ReactiveVar } from 'meteor/reactive-var'
import { Rundowns } from '../../../lib/collections/Rundowns'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import { Studios, Studio } from '../../../lib/collections/Studios'
import { MediaObject, MediaObjects } from '../../../lib/collections/MediaObjects'
import { PeripheralDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { ExternalMessageQueue } from '../../../lib/collections/ExternalMessageQueue'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { ISourceLayer } from 'tv-automation-sofie-blueprints-integration'
import { getCurrentTime } from '../../../lib/lib'

export namespace reactiveData {
	export function getRRundownId (rundownId: string): ReactiveVar<string | undefined> {
		const rVar = new ReactiveVar<string | undefined>(undefined)
		Tracker.autorun(() => {
			const rObj = Rundowns.findOne(rundownId)
			if (rObj) {
				rVar.set(rObj._id)
			} else {
				rVar.set(undefined)
			}
		})

		return rVar
	}

	export function getRRundownStudioId (rundownId: string): ReactiveVar<string | undefined> {
		const rVar = new ReactiveVar<string | undefined>(undefined)
		Tracker.autorun(() => {
			const rObj = Rundowns.findOne(rundownId)
			if (rObj) {
				rVar.set(rObj.studioId)
			} else {
				rVar.set(undefined)
			}
		})

		return rVar
	}

	export function getRRundownShowStyleBaseId (rundownId: string): ReactiveVar<string | undefined> {
		const rVar = new ReactiveVar<string | undefined>(undefined)
		Tracker.autorun(() => {
			const rObj = Rundowns.findOne(rundownId)
			if (rObj) {
				rVar.set(rObj.showStyleBaseId)
			} else {
				rVar.set(undefined)
			}
		})

		return rVar
	}

	export function getRStudio (siId: string): ReactiveVar<Studio | undefined> {
		const rVar = new ReactiveVar<Studio | undefined>(undefined, ReactiveDataHelper.simpleObjCompare)
		Tracker.autorun(() => {
			const studio = Studios.findOne(siId)
			rVar.set(studio)
		})

		return rVar
	}

	export function getRPieces (rundownId: string): ReactiveVar<Piece[]> {
		const rVar = new ReactiveVar<Piece[]>([])

		Tracker.autorun(() => {
			const slis = Pieces.find({
				rundownId: rundownId
			}).fetch()
			rVar.set(slis)
		})
		return rVar
	}

	export function getRSourceLayer (showStyleBase: ShowStyleBase, sourceLayerId: string): ReactiveVar<ISourceLayer | undefined> {
		const rVar = new ReactiveVar<ISourceLayer | undefined>(undefined, ReactiveDataHelper.simpleObjCompare)
		Tracker.autorun(() => {
			const sourceLayer = showStyleBase.sourceLayers.find((item) => item._id === sourceLayerId)
			rVar.set(sourceLayer)
		})
		return rVar
	}

	export function getRMediaObject (mediaId: string): ReactiveVar<MediaObject | undefined> {
		const rVar = new ReactiveVar<MediaObject | undefined>(undefined, ReactiveDataHelper.simpleObjCompare)
		Tracker.autorun(() => {
			const mediaObj = MediaObjects.findOne({ mediaId })
			rVar.set(mediaObj)
		})

		return rVar
	}

	export function getRPeripheralDevices (studioId: string): ReactiveVar<PeripheralDevice[]> {
		const rVar = new ReactiveVar<PeripheralDevice[]>([])

		Tracker.autorun(() => {
			const allDevices: PeripheralDevice[] = []
			const peripheralDevices = PeripheralDevices.find({
				studioId: studioId
			}).fetch()
			allDevices.splice(allDevices.length, 0, ...peripheralDevices)
			peripheralDevices.forEach((i) => {
				const subDevices = PeripheralDevices.find({ parentDeviceId: i._id }).fetch()
				allDevices.splice(allDevices.length, 0, ...subDevices)
			})
			rVar.set(allDevices)
		})

		return rVar
	}

	export function getUnsentExternalMessageCount (studioId: string): ReactiveVar<number> {
		const rVar = new ReactiveVar<number>(0)

		Tracker.autorun(() => {
			let now = getCurrentTime()
			const unsentMessages = ExternalMessageQueue.find({
				expires: { $gt: now },
				studioId: { $eq: studioId },
				sent: { $not: { $gt: 0 } },
				tryCount: { $not: { $lt: 1 } }
			}, {
				limit: 10
			}).fetch()
			rVar.set(unsentMessages.length)
		})

		return rVar
	}
}
