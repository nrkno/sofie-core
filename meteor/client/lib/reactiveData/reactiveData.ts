import { Tracker } from 'meteor/tracker'
import { ReactiveDataHelper } from './reactiveDataHelper'
import { ReactiveVar } from 'meteor/reactive-var'
import { RunningOrders } from '../../../lib/collections/RunningOrders'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'
import { ISourceLayer, StudioInstallations, StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { MediaObject, MediaObjects } from '../../../lib/collections/MediaObjects'

export namespace reactiveData {
	export const getRRunningOrderId = ReactiveDataHelper.memoizeRVar<string | undefined>(function getRRunningOrderId (roId: string): ReactiveVar<string | undefined> {
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
	})

	export const getRRunningOrderStudioId = ReactiveDataHelper.memoizeRVar<string | undefined>(function getRRunningOrderStudioId (roId: string): ReactiveVar<string | undefined> {
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
	})

	export const getRStudioInstallation = ReactiveDataHelper.memoizeRVar<StudioInstallation | undefined>(function getRStudioInstallation (siId: string): ReactiveVar<StudioInstallation | undefined> {
		const rVar = new ReactiveVar<StudioInstallation | undefined>(undefined, ReactiveDataHelper.simpleObjCompare)
		Tracker.autorun(() => {
			const si = StudioInstallations.findOne(siId)
			rVar.set(si)
		})

		return rVar
	})

	export const getRSegmentLineItems = ReactiveDataHelper.memoizeRVar<SegmentLineItem[]>(function getRSegmentLineItems (roId: string): ReactiveVar<SegmentLineItem[]> {
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
	})

	export const getRSourceLayer = ReactiveDataHelper.memoizeRVar<ISourceLayer | undefined>(function getRSourceLayer (studioId: string, sourceLayerId: string): ReactiveVar<ISourceLayer | undefined> {
		const rVar = new ReactiveVar<ISourceLayer | undefined>(undefined, ReactiveDataHelper.simpleObjCompare)
		Tracker.autorun(() => {
			const si = StudioInstallations.findOne(studioId)
			if (si) {
				const sourceLayer = si.sourceLayers.find((item) => item._id === sourceLayerId)
				rVar.set(sourceLayer)
			} else {
				rVar.set(undefined)
			}
		})

		return rVar
	})

	export const getRMediaObject = ReactiveDataHelper.memoizeRVar<MediaObject | undefined>(function getRMediaObject (mediaId: string): ReactiveVar<MediaObject | undefined> {
		const rVar = new ReactiveVar<MediaObject | undefined>(undefined, ReactiveDataHelper.simpleObjCompare)
		Tracker.autorun(() => {
			const mediaObj = MediaObjects.findOne({ mediaId })
			rVar.set(mediaObj)
		})

		return rVar
	})
}
