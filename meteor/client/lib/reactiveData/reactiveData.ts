import { Tracker } from 'meteor/tracker'
import { ReactiveDataHelper } from './reactiveDataHelper'
import { ReactiveVar } from 'meteor/reactive-var'
import { RunningOrders } from '../../../lib/collections/RunningOrders'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { StudioInstallations, StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { MediaObject, MediaObjects } from '../../../lib/collections/MediaObjects'
import { PeripheralDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { ISourceLayer } from 'tv-automation-sofie-blueprints-integration'

export namespace reactiveData {
	export const getRRunningOrderId = ReactiveDataHelper.memoizeRVar(
		function getRRunningOrderId (roId: string): ReactiveVar<string | undefined> {
			const rVar = new ReactiveVar<string | undefined>(undefined)
			Tracker.autorun(() => {
				const rObj = RunningOrders.findOne(roId)
				if (rObj) {
					rVar.set(rObj._id)
				} else {
					rVar.set(undefined)
				}
			})

			return rVar
		}
		, 'getRRunningOrderId')

	export const getRRunningOrderStudioId = ReactiveDataHelper.memoizeRVar(
		function getRRunningOrderStudioId (roId: string): ReactiveVar<string | undefined> {
			const rVar = new ReactiveVar<string | undefined>(undefined)
			Tracker.autorun(() => {
				const rObj = RunningOrders.findOne(roId)
				if (rObj) {
					rVar.set(rObj.studioInstallationId)
				} else {
					rVar.set(undefined)
				}
			})

			return rVar
		}
		, 'getRRunningOrderStudioId')
	export const getRRunningOrderShowStyleBaseId = ReactiveDataHelper.memoizeRVar(
		function getRRunningOrderShowStyleBaseId (roId: string): ReactiveVar<string | undefined> {
			const rVar = new ReactiveVar<string | undefined>(undefined)
			Tracker.autorun(() => {
				const rObj = RunningOrders.findOne(roId)
				if (rObj) {
					rVar.set(rObj.showStyleBaseId)
				} else {
					rVar.set(undefined)
				}
			})

			return rVar
		}
		, 'getRRunningOrderShowStyleBaseId')

	export const getRStudioInstallation = ReactiveDataHelper.memoizeRVar(
		function getRStudioInstallation (siId: string): ReactiveVar<StudioInstallation | undefined> {
			const rVar = new ReactiveVar<StudioInstallation | undefined>(undefined, ReactiveDataHelper.simpleObjCompare)
			Tracker.autorun(() => {
				const si = StudioInstallations.findOne(siId)
				rVar.set(si)
			})

			return rVar
		}
		, 'getRStudioInstallation')

	export const getRSegmentLineItems = ReactiveDataHelper.memoizeRVar(
		function getRSegmentLineItems (roId: string): ReactiveVar<SegmentLineItem[]> {
			const rVar = new ReactiveVar<SegmentLineItem[]>([])

			Tracker.autorun(() => {
				const slis = SegmentLineItems.find({
					runningOrderId: roId
				}).fetch()
				rVar.set(slis)
			})
			return rVar
		}
		, 'getRSegmentLineItems')

	export const getRSourceLayer = ReactiveDataHelper.memoizeRVar(
		function getRSourceLayer (showStyleBase: ShowStyleBase, sourceLayerId: string): ReactiveVar<ISourceLayer | undefined> {
			const rVar = new ReactiveVar<ISourceLayer | undefined>(undefined, ReactiveDataHelper.simpleObjCompare)
			Tracker.autorun(() => {
				// const showStyleBase = ShowStyleBases.findOne(studioId)
				if (showStyleBase) {
					const sourceLayer = showStyleBase.sourceLayers.find((item) => item._id === sourceLayerId)
					rVar.set(sourceLayer)
				} else {
					rVar.set(undefined)
				}
			})
			return rVar
		}
		, 'getRSourceLayer')

	export const getRMediaObject = ReactiveDataHelper.memoizeRVar(
		function getRMediaObject (mediaId: string): ReactiveVar<MediaObject | undefined> {
			const rVar = new ReactiveVar<MediaObject | undefined>(undefined, ReactiveDataHelper.simpleObjCompare)
			Tracker.autorun(() => {
				const mediaObj = MediaObjects.findOne({ mediaId })
				rVar.set(mediaObj)
			})

			return rVar
		}
		, 'getRMediaObject')

	export const getRPeripheralDevices = ReactiveDataHelper.memoizeRVar(
		function getRPeripheralDevices (studioId: string): ReactiveVar<PeripheralDevice[]> {
			const rVar = new ReactiveVar<PeripheralDevice[]>([])

			Tracker.autorun(() => {
				const allDevices: PeripheralDevice[] = []
				const peripheralDevices = PeripheralDevices.find({
					studioInstallationId: studioId
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
		, 'getRPeripheralDevices')
}
