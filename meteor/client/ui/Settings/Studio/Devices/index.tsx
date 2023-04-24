import React from 'react'
import { PeripheralDevices } from '../../../../collections'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { StudioSelectDevices } from './SelectDevices'
import { StudioPlayoutSubDevices } from './PlayoutSubDevices'
import { StudioInputSubDevices } from './InputSubDevices'
import { StudioIngestSubDevices } from './IngestSubDevices'

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

	return (
		<>
			<StudioSelectDevices studioId={studioId} studioDevices={studioDevices} />

			<StudioPlayoutSubDevices studioId={studioId} studioDevices={studioDevices} />

			<StudioIngestSubDevices studioId={studioId} studioDevices={studioDevices} />

			<StudioInputSubDevices studioId={studioId} studioDevices={studioDevices} />
		</>
	)
}
