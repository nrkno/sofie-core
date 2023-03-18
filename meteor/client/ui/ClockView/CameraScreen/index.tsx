import React, { useEffect, useMemo, useState } from 'react'
import { CameraContent, RemoteContent } from '@sofie-automation/blueprints-integration'
import { RundownId, SegmentId, ShowStyleBaseId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PubSub } from '../../../../lib/api/pubsub'
import { UIStudio } from '../../../../lib/api/studios'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { PieceExtended } from '../../../../lib/Rundown'
import { PartInstances, Rundowns } from '../../../collections'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { UIStudios } from '../../Collections'
import { Rundown as RundownComponent } from './Rundown'
import { useLocation } from 'react-router-dom'
import { parse as queryStringParse } from 'query-string'
import { PartInstance } from '../../../../lib/collections/PartInstances'
import { OrderedPartsProvider } from './OrderedPartsProvider'

interface IProps {
	playlist: RundownPlaylist | undefined
	studioId: StudioId
}

interface IActivePartInstancesContext {
	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined
}

type FilterFuction = (piece: PieceExtended) => boolean

export const StudioContext = React.createContext<UIStudio | undefined>(undefined)
export const RundownToShowStyleContext = React.createContext<Map<RundownId, ShowStyleBaseId>>(new Map())
export const PieceFilter = React.createContext<FilterFuction>(() => true)
export const ActivePartInstancesContext = React.createContext<IActivePartInstancesContext>({
	currentPartInstance: undefined,
	nextPartInstance: undefined,
})
export const CurrentSegmentIdContext = React.createContext<SegmentId | undefined>(undefined)
export const NextSegmentIdContext = React.createContext<SegmentId | undefined>(undefined)
export const AreaZoom = React.createContext<number>(1)

const PARAM_NAME_STUDIO_LABEL = 'studioLabel'
const PARAM_NAME_SOURCE_LAYER_IDS = 'sourceLayerIds'

export function CameraScreen({ playlist, studioId }: IProps): JSX.Element | null {
	const playlistIds = playlist ? [playlist._id] : []

	const [studioLabels, setStudioLabels] = useState<string[] | null>(null)
	const [sourceLayerIds, setSourceLayerIds] = useState<string[] | null>(null)

	const location = useLocation()
	useEffect(() => {
		const queryParams = queryStringParse(location.search, {
			arrayFormat: 'comma',
		})

		const studioLabelParam = queryParams[PARAM_NAME_STUDIO_LABEL] ?? null
		const sourceLayerTypeParam = queryParams[PARAM_NAME_SOURCE_LAYER_IDS] ?? null

		setStudioLabels(
			Array.isArray(studioLabelParam) ? studioLabelParam : studioLabelParam === null ? null : [studioLabelParam]
		)
		setSourceLayerIds(
			Array.isArray(sourceLayerTypeParam)
				? sourceLayerTypeParam
				: sourceLayerTypeParam === null
				? null
				: [sourceLayerTypeParam]
		)
	}, [location.search])

	const rundowns = useTracker(
		() =>
			Rundowns.find({
				playlistId: {
					$in: playlistIds,
				},
			}).fetch(),
		[playlistIds.join(',')],
		[] as Rundown[]
	)

	const rundownIds = useMemo(() => rundowns.map((rundown) => rundown._id), [rundowns])
	const showStyleBaseIds = useMemo(() => rundowns.map((rundown) => rundown.showStyleBaseId), [rundowns])

	useSubscription(PubSub.rundowns, playlistIds, null)
	useSubscription(PubSub.segments, {
		rundownId: {
			$in: rundownIds,
		},
	})
	useSubscription(PubSub.uiStudio, studioId)
	useSubscription(PubSub.partInstances, rundownIds, playlist?.activationId)

	useSubscription(PubSub.parts, rundownIds)

	useSubscription(PubSub.pieceInstancesSimple, {
		rundownId: {
			$in: rundownIds,
		},
	})

	useSubscription(PubSub.pieces, {
		startRundownId: {
			$in: rundownIds,
		},
	})

	const currentPartInstance = useTracker(
		() => (playlist?.currentPartInstanceId ? PartInstances.findOne(playlist?.currentPartInstanceId) : undefined),
		[playlist?.currentPartInstanceId],
		undefined
	)
	const nextPartInstance = useTracker(
		() => (playlist?.nextPartInstanceId ? PartInstances.findOne(playlist?.nextPartInstanceId) : undefined),
		[playlist?.nextPartInstanceId],
		undefined
	)

	const partInstanceContext = useMemo(
		() => ({
			currentPartInstance,
			nextPartInstance,
		}),
		[currentPartInstance, nextPartInstance]
	)

	const currentSegmentId = useMemo(() => currentPartInstance?.segmentId, [currentPartInstance])
	const nextSegmentId = useMemo(() => nextPartInstance?.segmentId, [nextPartInstance])

	useEffect(() => {
		document.body.classList.add('dark', 'xdark', 'vertical-overflow-only')

		const containerEl = document.querySelector('#render-target > .container-fluid.header-clear')
		if (containerEl) containerEl.classList.remove('header-clear')

		return () => {
			document.body.classList.remove('dark', 'xdark', 'vertical-overflow-only')
			if (containerEl) containerEl.classList.add('header-clear')
		}
	}, [])

	const studio = useTracker(() => UIStudios.findOne(studioId), [studioId], undefined)

	const rundownToShowStyle = useMemo(() => {
		const result = new Map<RundownId, ShowStyleBaseId>()
		rundowns.forEach((rundown) => {
			result.set(rundown._id, rundown.showStyleBaseId)
		})
		return result
	}, [rundowns.map((rundown) => rundown._id).join(','), showStyleBaseIds.join(',')])

	const pieceFilterFunction = useMemo(() => {
		return (piece: PieceExtended) => {
			const content = piece.instance.piece.content as CameraContent | RemoteContent
			if (
				sourceLayerIds !== null &&
				(piece.sourceLayer?._id === undefined || !sourceLayerIds.includes(piece.sourceLayer?._id))
			)
				return false
			if (studioLabels !== null && !studioLabels.includes(content.studioLabel)) return false
			return true
		}
	}, [studioLabels, sourceLayerIds])

	if (!playlist || !studio) return null

	const rundownIdsBefore: RundownId[] = []

	return (
		<StudioContext.Provider value={studio}>
			<RundownToShowStyleContext.Provider value={rundownToShowStyle}>
				<PieceFilter.Provider value={pieceFilterFunction}>
					<OrderedPartsProvider>
						<ActivePartInstancesContext.Provider value={partInstanceContext}>
							<CurrentSegmentIdContext.Provider value={currentSegmentId}>
								<NextSegmentIdContext.Provider value={nextSegmentId}>
									<AreaZoom.Provider value={1 / 10000}>
										<div className="camera-screen">
											{rundowns.map((rundown) => {
												rundownIdsBefore.push(rundown._id)
												return (
													<RundownComponent
														key={unprotectString(rundown._id)}
														playlist={playlist}
														rundown={rundown}
														rundownIdsBefore={rundownIdsBefore.slice(0, -1)}
													/>
												)
											})}
										</div>
									</AreaZoom.Provider>
								</NextSegmentIdContext.Provider>
							</CurrentSegmentIdContext.Provider>
						</ActivePartInstancesContext.Provider>
					</OrderedPartsProvider>
				</PieceFilter.Provider>
			</RundownToShowStyleContext.Provider>
		</StudioContext.Provider>
	)
}
