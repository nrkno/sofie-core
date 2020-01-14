
import * as React from 'react'
import * as _ from 'underscore'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { callMethod } from '../lib/clientAPI'
import { ManualPlayoutAPI } from '../../lib/api/manualPlayout'

import { Studios, Studio, MappingExt } from '../../lib/collections/Studios'
import {
	PeripheralDevices,
} from '../../lib/collections/PeripheralDevices'
import {
	PlayoutDeviceSettings
} from '../../lib/collections/PeripheralDeviceSettings/playoutDevice'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { EditAttribute } from '../lib/EditAttribute'
import { mappingIsCasparCG, mappingIsQuantel } from '../../lib/api/studios'
import { PubSub } from '../../lib/api/pubsub'
import { TSR } from 'tv-automation-sofie-blueprints-integration'
interface IManualPlayoutProps {
}
interface IManualPlayoutState {
	inputValues: {
		[id: string]: {
			[no: string]: string
		}
	}
}
export class ManualPlayout extends MeteorReactComponent<IManualPlayoutProps, IManualPlayoutState> {

	constructor (props: IManualPlayoutProps) {
		super(props)
		this.state = {
			inputValues: {}
		}
	}
	UNSAFE_componentWillMount () {
		this.subscribe(PubSub.studios, {})
		this.subscribe(PubSub.peripheralDevices, {})
	}
	getStudios () {
		return Studios.find().fetch()
	}
	getAtems (studio: Studio) {

		let atems: {[id: string]: TSR.DeviceOptionsAtem} = {}

		let parentDevices = PeripheralDevices.find({
			studioId: studio._id,
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT
		}).fetch()

		_.each(parentDevices, (parentDevice) => {
			if (parentDevice.settings) {
				let settings = parentDevice.settings as PlayoutDeviceSettings
				_.each(
					settings.devices, (device, deviceId) => {
						if (device.type === TSR.DeviceType.ATEM) {
							atems[deviceId] = device
						}
					}
				)
			}
		})
		return atems
	}
	getAtemMEs (studio: Studio) {
		let mappings: {[layer: string]: TSR.MappingAtem} = {}
		_.each(studio.mappings, (mapping, layerId) => {
			if (mapping.device === TSR.DeviceType.ATEM) {
				// @ts-ignore
				let mappingAtem = mapping as MappingAtem
				if (mappingAtem.mappingType === TSR.MappingAtemType.MixEffect) {
					mappings[layerId] = mappingAtem
				}

			}
		})
		return mappings
	}
	atemCamera (e: React.MouseEvent<HTMLElement>, studio: Studio, mappingLayerId: string, cam: number) {

		let o: TSR.TimelineObjAtemME = {
			id: 'camera_' + mappingLayerId,
			enable: {
				start: 'now'
			},
			layer: mappingLayerId,
			content: {
				deviceType: TSR.DeviceType.ATEM,
				type: TSR.TimelineContentTypeAtem.ME,

				me: {
					input: cam,
					transition: TSR.AtemTransitionStyle.CUT
				}
			}
		}
		callMethod(e, ManualPlayoutAPI.methods.insertTimelineObject, studio._id, o)
	}
	getManualLayers (studio: Studio) {
		let mappings: {[layer: string]: MappingExt} = {}
		_.each(studio.mappings, (mapping, layerId) => {
			if (
				mapping.device === TSR.DeviceType.CASPARCG ||
				mapping.device === TSR.DeviceType.QUANTEL
			) {
				mappings[layerId] = mapping

			}
		})
		return mappings
	}
	casparcgPlay (e: React.MouseEvent<HTMLElement>, studio: Studio, mappingLayerId: string) {

		let file = this.state.inputValues[mappingLayerId].file

		let o: TSR.TimelineObjCCGMedia = {
			id: 'caspar_' + mappingLayerId,
			enable: {
				start: 'now'
			},
			layer: mappingLayerId,
			content: {
				deviceType: TSR.DeviceType.CASPARCG,
				type: TSR.TimelineContentTypeCasparCg.MEDIA,

				file: file + '',

			}
		}
		callMethod(e, ManualPlayoutAPI.methods.insertTimelineObject, studio._id, o)
	}
	casparcgClear (e: React.MouseEvent<HTMLElement>, studio: Studio, mappingLayerId: string) {
		callMethod(e, ManualPlayoutAPI.methods.removeTimelineObject, studio._id, 'caspar_' + mappingLayerId)
	}
	quantelPlay (e: React.MouseEvent<HTMLElement>, studio: Studio, mappingLayerId: string) {

		let input = this.state.inputValues[mappingLayerId]

		let o: TSR.TimelineObjQuantelAny = {

			id: 'quantel_' + mappingLayerId ,

			classes: [],
			content: {
				deviceType: TSR.DeviceType.QUANTEL,

				title: input.title || '',
				// @ts-ignore temporary ignore, remove soon
				guid: input.guid || ''
			},
			enable: {
				start: 'now',
				duration: null
			},
			layer: mappingLayerId,
			// objectType: 'rundown',
			// priority: 0,
			// rundownId: '',
			// studioId: 'studio0'

		}

		callMethod(e, ManualPlayoutAPI.methods.insertTimelineObject, studio._id, o)
	}
	quantelClear (e: React.MouseEvent<HTMLElement>, studio: Studio, mappingLayerId: string) {
		callMethod(e, ManualPlayoutAPI.methods.removeTimelineObject, studio._id, 'quantel_' + mappingLayerId)
	}
	onInputChange (id: string, no: string, value: any) {

		let iv = this.state.inputValues
		if (!iv[id]) iv[id] = {}
		iv[id][no] = value

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
									_.map(this.getAtemMEs(studio), (mapping, mappingLayerId) => {
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
									_.map(this.getManualLayers(studio), (mapping, mappingLayerId) => {
										if (mappingIsCasparCG(mapping)) {
											return <tr key={mappingLayerId}>
												<th>{mappingLayerId}</th>
												<td>
													<button className='btn btn-primary' onClick={(e) => this.casparcgPlay(e, studio, mappingLayerId)}>
														Caspar Play
													</button>
													<button className='btn btn-primary' onClick={(e) => this.casparcgClear(e, studio, mappingLayerId)}>
														Clear
													</button>
												</td>
												<td>
													<EditAttribute
														updateFunction={(_edit, value) => this.onInputChange(mappingLayerId, 'file', value)}
														type='text'
														overrideDisplayValue={this.state.inputValues[mappingLayerId]}
													/>
												</td>
											</tr>
										} else if (mappingIsQuantel(mapping)) {
											return <tr key={mappingLayerId}>
												<th>{mappingLayerId}</th>
												<td>
													<button className='btn btn-primary' onClick={(e) => this.quantelPlay(e, studio, mappingLayerId)}>
														Quantel Play
													</button>
													<button className='btn btn-primary' onClick={(e) => this.quantelClear(e, studio, mappingLayerId)}>
														Clear
													</button>
												</td>
												<td>
													<EditAttribute
														updateFunction={(_edit, value) => this.onInputChange(mappingLayerId, 'title', value)}
														type='text'
														overrideDisplayValue={(this.state.inputValues[mappingLayerId] || {}).title}
													/>
												</td>
												<td>
													<EditAttribute
														updateFunction={(_edit, value) => this.onInputChange(mappingLayerId, 'guid', value)}
														type='text'
														overrideDisplayValue={(this.state.inputValues[mappingLayerId] || {}).guid}
													/>
												</td>
											</tr>
										}
										return null
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
