import * as React from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { deserializeTimelineBlob, RoutedTimeline } from '../../../lib/collections/Timeline'
import { applyToArray, clone, protectString } from '../../../lib/lib'
import { PubSub } from '../../../lib/api/pubsub'
import { TimelineState, Resolver, ResolvedTimelineObjectInstance } from 'superfly-timeline'
import { TimelineContentObject, transformTimeline } from '@sofie-automation/corelib/dist/playout/timeline'
import { getCurrentTimeReactive } from '../../lib/currentTimeReactive'
import { StudioSelect } from './StudioSelect'
import { StudioId } from '../../../lib/collections/Studios'
import { Mongo } from 'meteor/mongo'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useCallback, useMemo, useState } from 'react'

const StudioTimeline = new Mongo.Collection<RoutedTimeline>('studioTimeline')

interface TimelineViewRouteParams {
	studioId: string | undefined
}
function TimelineView() {
	const { t } = useTranslation()

	const { studioId } = useParams<TimelineViewRouteParams>()

	return (
		<div className="mtl gutter">
			<header className="mvs">
				<h1>{t('Timeline')}</h1>
			</header>
			<div className="mod mvl">
				{studioId && (
					<div>
						<ComponentTimelineSimulate studioId={protectString(studioId)} />
					</div>
				)}
			</div>
		</div>
	)
}

interface ITimelineSimulateProps {
	studioId: StudioId
}
function ComponentTimelineSimulate({ studioId }: ITimelineSimulateProps) {
	useSubscription(PubSub.timelineForStudio, studioId)

	const now = useTracker(() => getCurrentTimeReactive(), [], Date.now())
	const tlComplete = useTracker(() => StudioTimeline.findOne(studioId), [studioId])

	const [viewTime, setViewTime] = useState<number | null>(null)
	const selectViewTime = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
		const val = Number(e.target.value)
		setViewTime(isNaN(val) ? null : val)
	}, [])

	const [layerFilterText, setLayerFilterText] = useState<string>('')
	const changeLayerFilter = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setLayerFilterText(e.target.value)
		if (e.target.value === '') {
			this.setState({
				layerFilter: undefined,
				layerFilterText: e.target.value,
			})
			return
		}

		if (e.target.value.match(/^\/.+\/$/)) {
			this.setState({
				layerFilter: new RegExp(e.target.value.substr(1, e.target.value.length - 2)),
				layerFilterText: e.target.value,
			})
		} else {
			this.setState({
				layerFilter: e.target.value,
				layerFilterText: e.target.value,
			})
		}
	}, [])
	const layerFilter = useMemo<RegExp | string | undefined>(() => {
		if (!layerFilterText || typeof layerFilterText !== 'string') {
			return undefined
		} else if (layerFilterText.match(/^\/.+\/$/)) {
			return new RegExp(layerFilterText.substr(1, layerFilterText.length - 2))
		} else {
			return layerFilterText
		}
	}, [layerFilterText])

	const [allStates, errorMsg] = useMemo(() => {
		try {
			const timelineObj = tlComplete && deserializeTimelineBlob(tlComplete.timelineBlob)
			console.log('regen timeline', tlComplete?.timelineHash, tlComplete?.generated)

			let timeline: TimelineContentObject[] = []
			if (tlComplete && timelineObj) {
				timeline = transformTimeline(
					timelineObj
						.map((o) => {
							const obj = clone(o)
							applyToArray(o.enable, (enable) => {
								if (enable.start === 'now') {
									enable.start = now
								}
							})
							return obj
						})
						.sort((a, b) => {
							if (a.id > b.id) {
								return 1
							}
							if (a.id < b.id) {
								return -1
							}
							return 0
						})
				)
			}

			// TODO - dont repeat unless changed
			const tl = Resolver.resolveTimeline(timeline, { time: tlComplete?.generated || now })
			return [Resolver.resolveAllStates(tl), undefined]
		} catch (e) {
			return [undefined, `Failed to update timeline:\n${e}`]
		}
	}, [tlComplete, now])

	const state = allStates ? Resolver.getState(allStates, viewTime ?? now) : undefined
	const times = _.uniq((allStates?.nextEvents ?? []).map((e) => e.time))

	return (
		<div>
			<h2 className="mhn">Timeline state</h2>
			<div className="flex-row mbl">
				<div className="col mrl">
					Time:{' '}
					<select onChange={selectViewTime} value={viewTime ?? 'now'}>
						<option id="now">Now: {now}</option>
						{times.map((e) => (
							<option id={e + ''} key={e}>
								{e}
							</option>
						))}
					</select>
				</div>
				<div className="col">
					Layer Filter:{' '}
					<input type="text" value={layerFilterText} onChange={changeLayerFilter} placeholder="Text or /RegEx/" />
				</div>
			</div>

			<div>
				{errorMsg ? (
					<p>{errorMsg}</p>
				) : (
					<div>
						<table className="testtools-timelinetable">
							<tbody>
								<tr>
									<th>Layer</th>
									<th>id</th>
									<th>Enable</th>
									<th>Instance Times</th>
									<th>type</th>
									<th>classes</th>
									<th>content</th>
								</tr>
								{state ? renderTimelineState(state, layerFilter) : ''}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	)
}

function renderTimelineState(state: TimelineState, filter: RegExp | string | undefined) {
	const sortedLayers = _.sortBy(Object.values(state.layers), (o) => o.layer)
	let filteredLayers: ResolvedTimelineObjectInstance[] = sortedLayers
	if (filter) {
		if (typeof filter === 'string') {
			filteredLayers = filteredLayers.filter((o) => String(o.layer).includes(filter))
		} else {
			filteredLayers = filteredLayers.filter((o) => !!String(o.layer).match(filter))
		}
	}

	return filteredLayers.map((o) => (
		<tr key={o.layer}>
			<td>{o.layer}</td>
			<td style={{ maxWidth: '25vw', minWidth: '10vw', overflowWrap: 'anywhere' }}>{o.id}</td>
			<td style={{ whiteSpace: 'pre', maxWidth: '15vw', overflowX: 'auto' }}>
				{JSON.stringify(o.enable, undefined, '\t')}
			</td>
			<td>
				Start: {o.instance.start}
				<br />
				End: {o.instance.end}
			</td>
			<td>{o.content.type}</td>
			<td>{(o.classes || []).join('<br />')}</td>
			<td style={{ whiteSpace: 'pre' }}>{JSON.stringify(o.content, undefined, '\t')}</td>
		</tr>
	))
}

function TimelineStudioSelect() {
	return <StudioSelect path="timeline" title="Timeline" />
}

export { TimelineView, TimelineStudioSelect }
