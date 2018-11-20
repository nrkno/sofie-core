import { Tracker } from 'meteor/tracker'
import { ReactiveDataHelper } from './reactiveDataHelper'
import { ReactiveVar } from 'meteor/reactive-var'
import { RunningOrders } from '../../../lib/collections/RunningOrders'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { StudioInstallations, StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { MediaObject, MediaObjects } from '../../../lib/collections/MediaObjects'
import { PeripheralDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { ISourceLayer, ShowStyleBase, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'

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
	)

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
	)
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
	)

	export const getRStudioInstallation = ReactiveDataHelper.memoizeRVar(
		function getRStudioInstallation (siId: string): ReactiveVar<StudioInstallation | undefined> {
			const rVar = new ReactiveVar<StudioInstallation | undefined>(undefined, ReactiveDataHelper.simpleObjCompare)
			Tracker.autorun(() => {
				const si = StudioInstallations.findOne(siId)
				rVar.set(si)
			})

			return rVar
		}
	)

	export const getRSegmentLineItems = ReactiveDataHelper.memoizeRVar(
		function getRSegmentLineItems (roId: string): ReactiveVar<SegmentLineItem[]> {
			const rVar = new ReactiveVar<SegmentLineItem[]>([], (oldVal: SegmentLineItem[], newVal: SegmentLineItem[]) => {
				return !((oldVal !== newVal) || (oldVal.length !== newVal.length))
			})

			Tracker.autorun(() => {
				const slis = SegmentLineItems.find({
					runningOrderId: roId
				}).fetch()
				rVar.set(slis)
			})
			return rVar
		}
	)

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
	)

	export const getRMediaObject = ReactiveDataHelper.memoizeRVar(
		function getRMediaObject (mediaId: string): ReactiveVar<MediaObject | undefined> {
			const rVar = new ReactiveVar<MediaObject | undefined>(undefined, ReactiveDataHelper.simpleObjCompare)
			Tracker.autorun(() => {
				const mediaObj = MediaObjects.findOne({ mediaId })
				rVar.set(mediaObj)
			})

			return rVar
		}
	)

	export const getRPeripheralDevices = ReactiveDataHelper.memoizeRVar(
		function getRPeripheralDevices (studioId: string): ReactiveVar<PeripheralDevice[]> {
			const rVar = new ReactiveVar<PeripheralDevice[]>([])

			Tracker.autorun(() => {
				const peripheralDevices = PeripheralDevices.find({
					studioInstallationId: studioId
				}).fetch()
				rVar.set(peripheralDevices)
			})

			return rVar
		}
	)
}
