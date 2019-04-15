
import * as React from 'react'
import * as _ from 'underscore'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { callMethod } from '../lib/clientAPI'
import { ManualPlayoutAPI } from '../../lib/api/manualPlayout'

import {
	Timeline as TimelineTypes,
	TimelineObjAtemME,
	TimelineContentTypeAtem,
	AtemTransitionStyle,
	DeviceType as PlayoutDeviceType,
	MappingAtem,
	MappingAtemType,
	MappingCasparCG,
	TimelineObjCCGMedia,
	TimelineContentTypeCasparCg
} from 'timeline-state-resolver-types'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'
import {
	PeripheralDevices,
} from '../../lib/collections/PeripheralDevices'
import {
	PlayoutDeviceSettings,
	PlayoutDeviceSettingsDeviceAtem
} from '../../lib/collections/PeripheralDeviceSettings/playoutDevice'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { EditAttribute } from '../lib/EditAttribute'
interface IManualPlayoutProps {
}
interface IManualPlayoutState {
	inputValues: {[id: string]: string}
}
export class ManualPlayout extends MeteorReactComponent<IManualPlayoutProps, IManualPlayoutState> {

	constructor (props: IManualPlayoutProps) {
		super(props)
		this.state = {
			inputValues: {}
		}
	}
	componentWillMount () {
		this.subscribe('studioInstallations', {})
		this.subscribe('peripheralDevices', {})
	}
	getStudios () {
		return StudioInstallations.find().fetch()
	}
	getAtems (studio: StudioInstallation) {

		let atems: {[id: string]: PlayoutDeviceSettingsDeviceAtem} = {}

		let parentDevices = PeripheralDevices.find({
			studioInstallationId: studio._id,
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT
		}).fetch()

		_.each(parentDevices, (parentDevice) => {
			if (parentDevice.settings) {
				let settings = parentDevice.settings as PlayoutDeviceSettings
				_.each(
					settings.devices, (device, deviceId) => {
						if (device.type === PlayoutDeviceType.ATEM) {
							atems[deviceId] = device as PlayoutDeviceSettingsDeviceAtem
						}
					}
				)
			}
		})
		return atems
	}
	getAtemMEs (studio: StudioInstallation) {
		let mappings: {[layer: string]: MappingAtem} = {}
		_.each(studio.mappings, (mapping, layerId) => {
			if (mapping.device === PlayoutDeviceType.ATEM) {
				// @ts-ignore
				let mappingAtem = mapping as MappingAtem
				if (mappingAtem.mappingType === MappingAtemType.MixEffect) {
					mappings[layerId] = mappingAtem
				}

			}
		})
		return mappings
	}
	atemCamera (e: React.MouseEvent<HTMLElement>, studio: StudioInstallation, mappingLayerId: string, cam: number) {

		let o: TimelineObjAtemME = {
			id: 'camera_' + mappingLayerId,
			trigger: {
				type: TimelineTypes.TriggerType.TIME_ABSOLUTE,
				value: 'now'
			},
			LLayer: mappingLayerId,
			content: {
				type: TimelineContentTypeAtem.ME,
				attributes: {
					input: cam,
					transition: AtemTransitionStyle.CUT
				}
			}
		}
		callMethod(e, ManualPlayoutAPI.methods.insertTimelineObject, studio._id, o)
	}
	getCasparLayers (studio: StudioInstallation) {
		let mappings: {[layer: string]: MappingCasparCG} = {}
		_.each(studio.mappings, (mapping, layerId) => {
			if (mapping.device === PlayoutDeviceType.CASPARCG) {
				mappings[layerId] = mapping as MappingCasparCG

			}
		})
		return mappings
	}
	casparcgPlay (e: React.MouseEvent<HTMLElement>, studio: StudioInstallation, mappingLayerId: string) {

		let input = this.state.inputValues[mappingLayerId]

		let o: TimelineObjCCGMedia = {
			id: 'caspar_' + mappingLayerId,
			trigger: {
				type: TimelineTypes.TriggerType.TIME_ABSOLUTE,
				value: 'now'
			},
			LLayer: mappingLayerId,
			content: {
				type: TimelineContentTypeCasparCg.MEDIA,
				attributes: {
					file: input + '',
				}
			}
		}
		callMethod(e, ManualPlayoutAPI.methods.insertTimelineObject, studio._id, o)
	}
	casparcgClear (e: React.MouseEvent<HTMLElement>, studio: StudioInstallation, mappingLayerId: string) {
		callMethod(e, ManualPlayoutAPI.methods.removeTimelineObject, studio._id, 'caspar_' + mappingLayerId)
	}
	onInputChange (id: string, value: any) {

		let iv = this.state.inputValues
		iv[id] = value
		this.setState({
			inputValues: iv
		})
	}
	render () {
		return (
			<div>
				<h1>Manual control</h1>
				{
					_.map(this.getStudios(), (studio) => {
						return <div key={studio._id}>
							<h2>{studio.name}</h2>
							<h3 className='mhs'>ATEM Control</h3>
							<table>
								<tbody>
								{
									_.map( this.getAtemMEs(studio), (mapping, mappingLayerId) => {
										return <tr key={mappingLayerId}>
											<th>{mappingLayerId}</th>
											{
												_.map([1,2,3,4,5,6,7,8], (cam) => {
													return (
														<td key={cam}>
															<button className='btn btn-primary' onClick={(e) => this.atemCamera(e, studio, mappingLayerId, cam)}>
																Camera {cam}
															</button>
														</td>
													)
												})
											}
										</tr>
									})
								}
								</tbody>
							</table>
							<h3 className='mhs'>CasparCG Control</h3>
							<table>
								<tbody>
								{
									_.map( this.getCasparLayers(studio), (mapping, mappingLayerId) => {
										return <tr key={mappingLayerId}>
											<th>{mappingLayerId}</th>
											<td>
												<button className='btn btn-primary' onClick={(e) => this.casparcgPlay(e, studio, mappingLayerId)}>
													Play
												</button>
												<button className='btn btn-primary' onClick={(e) => this.casparcgClear(e, studio, mappingLayerId)}>
													Clear
												</button>
											</td>
											<td>
												<EditAttribute
													updateFunction={(_edit, value) => this.onInputChange(mappingLayerId, value)}
													type='text'
													overrideDisplayValue={this.state.inputValues[mappingLayerId]}
												/>
											</td>
										</tr>
									})
								}
								</tbody>
							</table>
						</div>
					})
				}
			</div>

		)
	}
}
