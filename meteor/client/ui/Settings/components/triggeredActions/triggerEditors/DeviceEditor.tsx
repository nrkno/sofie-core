import { IBlueprintDeviceTrigger } from '@sofie-automation/blueprints-integration'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import classNames from 'classnames'
import React, { useEffect } from 'react'
import { PubSub } from '../../../../../../lib/api/pubsub'
import { Studios } from '../../../../../../lib/collections/Studios'
import { DeviceTriggerPreview } from '../../../../../../server/publications/deviceTriggersPreview'
import { getCurrentTimeReactive } from '../../../../../lib/currentTimeReactive'
import { useSubscription, useTracker } from '../../../../../lib/ReactMeteorData/ReactMeteorData'
import { DeviceTriggersPreviews } from '../../../../Collections'
import { DeviceTrigger } from './DeviceTrigger'

interface IProps {
	trigger: IBlueprintDeviceTrigger
	modified?: boolean
	onChange: (newVal: IBlueprintDeviceTrigger) => void
}

const TIME_HORIZON = 1 * 60 * 1000 // 60 seconds

export const DeviceEditor = function DeviceEditor({ trigger, modified, onChange }: IProps) {
	const deviceTriggersPreview = useTracker(
		() => {
			const now = getCurrentTimeReactive()
			return DeviceTriggersPreviews.find({
				timestamp: {
					$gte: now - TIME_HORIZON,
				},
			})
				.fetch()
				.reverse()
		},
		[],
		[] as DeviceTriggerPreview[]
	)
	const studio = useTracker(() => Studios.findOne(), [], undefined)

	useSubscription(PubSub.deviceTriggersPreview, studio?._id ?? protectString(''))

	useEffect(() => {
		console.log(deviceTriggersPreview)
	}, [deviceTriggersPreview])

	return (
		<>
			<input
				type="text"
				className={classNames('form-control input text-input input-m', {
					bghl: modified,
				})}
				value={trigger.deviceId ?? ''}
				onChange={(e) =>
					onChange({
						...trigger,
						deviceId: e.target.value,
					})
				}
			/>
			<input
				type="text"
				className={classNames('form-control input text-input input-m', {
					bghl: modified,
				})}
				value={trigger.triggerId ?? ''}
				onChange={(e) =>
					onChange({
						...trigger,
						triggerId: e.target.value,
					})
				}
			/>
			<ul className="triggered-action-entry__trigger-editor__triggers-preview">
				{deviceTriggersPreview.map((trigger) => (
					<li key={unprotectString(trigger._id)}>
						<DeviceTrigger deviceId={trigger.triggerDeviceId} trigger={trigger.triggerId} />
					</li>
				))}
			</ul>
			{/* <EditAttribute
				type={'toggle'}
				className="sb-nocolor"
				overrideDisplayValue={trigger.up}
				updateFunction={(_e, newValue) =>
					onChange({
						...trigger,
						up: newValue,
					})
				}
				label={t('On release')}
			/> */}
		</>
	)
}
