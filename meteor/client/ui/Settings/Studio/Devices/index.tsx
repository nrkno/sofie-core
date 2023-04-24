import React from 'react'
import { PeripheralDevices } from '../../../../collections'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { StudioSelectDevices } from './SelectDevices'

interface IStudioDevicesProps {
	studioId: StudioId
}

export function StudioDevices({ studioId }: IStudioDevicesProps): JSX.Element {
	const studioDevices = useTracker(
		() =>
			PeripheralDevices.find({
				studioId: studioId,
			}).fetch(),
		[studioId],
		[]
	)

	return <StudioSelectDevices studioId={studioId} studioDevices={studioDevices} />
}
