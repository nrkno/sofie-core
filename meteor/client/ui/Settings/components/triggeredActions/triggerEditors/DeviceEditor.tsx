import { IBlueprintDeviceTrigger } from '@sofie-automation/blueprints-integration'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import classNames from 'classnames'
import React, { useMemo } from 'react'
import { PubSub } from '../../../../../../lib/api/pubsub'
import { Studios } from '../../../../../collections'
import { getCurrentTime } from '../../../../../../lib/lib'
import { UIDeviceTriggerPreview } from '../../../../../../server/publications/deviceTriggersPreview'
import { useSubscription, useTracker } from '../../../../../lib/ReactMeteorData/ReactMeteorData'
import { DeviceTriggersPreviews } from '../../../../Collections'
import { DeviceTrigger } from './DeviceTrigger'

interface IProps {
	trigger: IBlueprintDeviceTrigger
	modified?: boolean
	readonly?: boolean
	onChange: (newVal: IBlueprintDeviceTrigger) => void
}

export const DeviceEditor = function DeviceEditor({ trigger, modified, readonly, onChange }: IProps): JSX.Element {
	const opened = useMemo(() => getCurrentTime(), [])
	const deviceTriggersPreview = useTracker<UIDeviceTriggerPreview[], UIDeviceTriggerPreview[]>(
		() =>
			DeviceTriggersPreviews.find({
				timestamp: {
					$gte: opened,
				},
			})
				.fetch()
				.reverse(),
		[],
		[]
	)
	const studio = useTracker(() => Studios.findOne(), [], undefined)

	useSubscription(PubSub.deviceTriggersPreview, studio?._id ?? protectString(''))

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
				disabled={readonly}
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
				disabled={readonly}
			/>
			<ul className="triggered-action-entry__trigger-editor__triggers-preview">
				{deviceTriggersPreview.map((previewedTrigger) => (
					<li key={unprotectString(previewedTrigger._id)}>
						<h6>
							<DeviceTrigger
								deviceId={previewedTrigger.triggerDeviceId}
								trigger={previewedTrigger.triggerId}
								onClick={() => {
									onChange({
										...trigger,
										deviceId: previewedTrigger.triggerDeviceId,
										triggerId: previewedTrigger.triggerId,
									})
								}}
							/>
						</h6>

						{previewedTrigger.values && (
							<p>
								{Object.entries<string | number | boolean>(previewedTrigger.values).map(([key, value]) => (
									<span key={key}>
										{key}: {value}
									</span>
								))}
							</p>
						)}
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
