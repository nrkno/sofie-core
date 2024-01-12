import React, { useEffect, useRef } from 'react'
import { Clock } from '../StudioScreenSaver/Clock'
import { useTracker, useSubscription } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorPubSub } from '../../../lib/api/pubsub'
import { findNextPlaylist } from '../StudioScreenSaver/StudioScreenSaver'
// @ts-expect-error No types available
import Velocity from 'velocity-animate'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useSetDocumentClass } from '../util/useSetDocumentClass'

export function OverlayScreenSaver({ studioId }: Readonly<{ studioId: StudioId }>): JSX.Element {
	const studioNameRef = useRef<HTMLDivElement>(null)

	useSetDocumentClass('transparent')

	useSubscription(MeteorPubSub.uiStudio, studioId)
	useSubscription(MeteorPubSub.rundownPlaylistForStudio, studioId, false)

	const data = useTracker(() => findNextPlaylist(studioId), [studioId])

	function animate() {
		const el = studioNameRef.current

		if (el) {
			let i = 0
			let position = 0
			const lastPosition = parseFloat(el.dataset.lastPosition || '0') || 0
			const { width } = el.getBoundingClientRect()
			if (width === 0) {
				// abort the animation, as we are still waiting for the element to be filled in
				return
			}

			let parentWidth = 0
			if (el.parentElement) {
				const parentRect = el.parentElement?.getBoundingClientRect()
				parentWidth = parentRect.width
			}

			// try and find a nice random position, thats significanlty different from the last postion
			do {
				position = Math.random() * ((parentWidth * 5) / 6 - width)
			} while (Math.abs(position - lastPosition) < 200 && i++ < 10)
			el.dataset.lastPosition = position.toString()

			el.style.transform = `translate3d(${position}px, 0, 0.2px)`
			el.style.position = 'absolute'
			el.style.left = '0.2em'

			Velocity(
				el,
				{
					opacity: 1,
				},
				{
					duration: 3000,
					delay: 1000,
				}
			)
			Velocity(
				el,
				{
					opacity: 0,
				},
				{
					duration: 3000,
					delay: 5000,
					complete: () => animate(),
				}
			)
		}
	}

	useEffect(() => {
		const el = studioNameRef.current
		if (el && !data?.rundownPlaylist?.name) {
			animate()
		}
		return () => {
			if (el) {
				el.style.transform = ''
				el.style.opacity = ''
				el.style.position = ''
				el.style.left = ''
				Velocity(el, 'stop', true)
			}
		}
	}, [studioNameRef.current, data?.rundownPlaylist?.name, data?.studio?.name])

	return (
		<div className="clocks-overlay">
			<div className="clocks-lower-third bottom">
				{!data?.rundownPlaylist?.name && (
					<div className="clocks-current-segment-countdown clocks-segment-countdown"></div>
				)}
				<div className="clocks-studio-name" ref={studioNameRef}>
					{data?.studio?.name ?? null}
				</div>
				<div className="clocks-next-rundown">{data?.rundownPlaylist?.name ?? null}</div>
				<Clock className="clocks-time-now" />
			</div>
		</div>
	)
}
