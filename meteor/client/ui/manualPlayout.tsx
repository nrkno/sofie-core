import { TSR } from 'tv-automation-sofie-blueprints-integration'
import * as _ from 'underscore'
import { MeteorCall } from '../../lib/api/methods'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PubSub } from '../../lib/api/pubsub'
import { mappingIsCasparCG, mappingIsQuantel } from '../../lib/api/studios'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PlayoutDeviceSettings } from '../../lib/collections/PeripheralDeviceSettings/playoutDevice'
import { MappingExt, Studio, Studios } from '../../lib/collections/Studios'
import { EditAttribute } from '../lib/EditAttribute'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'

interface IManualPlayoutProps {}
interface IManualPlayoutState {
	inputValues: {
		[id: string]: {
			[no: string]: string
		}
	}
}
export class ManualPlayout extends MeteorReactComponent<IManualPlayoutProps, IManualPlayoutState> {
	constructor(props: IManualPlayoutProps) {
		super(props)
		this.state = {
			inputValues: {},
		}
	}
	componentDidMount() {
		this.subscribe(PubSub.studios, {})
		this.subscribe(PubSub.peripheralDevices, {})
	}
	getStudios() {
		return Studios.find().fetch()
	}
	getAtems(studio: Studio) {
		let atems: { [id: string]: TSR.DeviceOptionsAtem } = {}

		let parentDevices = PeripheralDevices.find({
			studioId: studio._id,
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
		}).fetch()

		_.each(parentDevices, (parentDevice) => {
			if (parentDevice.settings) {
				let settings = parentDevice.settings as PlayoutDeviceSettings
				_.each(settings.devices, (device, deviceId) => {
					if (device.type === TSR.DeviceType.ATEM) {
						atems[deviceId] = device
					}
				})
			}
		})
		return atems
	}
	getAtemMEs(studio: Studio) {
		let mappings: { [layer: string]: TSR.MappingAtem } = {}
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
	atemCamera(studio: Studio, mappingLayerId: string, cam: number) {
		let o: TSR.TimelineObjAtemME = {
			id: 'camera_' + mappingLayerId,
			enable: {
				start: 'now',
			},
			layer: mappingLayerId,
			content: {
				deviceType: TSR.DeviceType.ATEM,
				type: TSR.TimelineContentTypeAtem.ME,

				me: {
					input: cam,
					transition: TSR.AtemTransitionStyle.CUT,
				},
			},
		}
		MeteorCall.manualPlayout.insertTimelineObject(studio._id, o).catch(console.error)
	}
	getManualLayers(studio: Studio) {
		let mappings: { [layer: string]: MappingExt } = {}
		_.each(studio.mappings, (mapping, layerId) => {
			if (mapping.device === TSR.DeviceType.CASPARCG || mapping.device === TSR.DeviceType.QUANTEL) {
				mappings[layerId] = mapping
			}
		})
		return mappings
	}
	casparcgPlay(studio: Studio, mappingLayerId: string) {
		let file = this.state.inputValues[mappingLayerId].file

		let o: TSR.TimelineObjCCGMedia = {
			id: 'caspar_' + mappingLayerId,
			enable: {
				start: 'now',
			},
			layer: mappingLayerId,
			content: {
				deviceType: TSR.DeviceType.CASPARCG,
				type: TSR.TimelineContentTypeCasparCg.MEDIA,

				file: file + '',
			},
		}
		MeteorCall.manualPlayout.insertTimelineObject(studio._id, o).catch(console.error)
	}
	casparcgClear(studio: Studio, mappingLayerId: string) {
		MeteorCall.manualPlayout.removeTimelineObject(studio._id, 'caspar_' + mappingLayerId).catch(console.error)
	}
	quantelPlay(studio: Studio, mappingLayerId: string) {
		let input = this.state.inputValues[mappingLayerId]

		let o: TSR.TimelineObjQuantelAny = {
			id: 'quantel_' + mappingLayerId,

			classes: [],
			content: {
				deviceType: TSR.DeviceType.QUANTEL,

				title: input.title || '',
				// @ts-ignore temporary ignore, remove soon
				guid: input.guid || '',
			},
			enable: {
				start: 'now',
				duration: null,
			},
			layer: mappingLayerId,
			// objectType: 'rundown',
			// priority: 0,
			// rundownId: '',
			// studioId: 'studio0'
		}

		MeteorCall.manualPlayout.insertTimelineObject(studio._id, o).catch(console.error)
	}
	quantelClear(studio: Studio, mappingLayerId: string) {
		MeteorCall.manualPlayout.removeTimelineObject(studio._id, 'quantel_' + mappingLayerId).catch(console.error)
	}
	onInputChange(id: string, no: string, value: any) {
		let iv = this.state.inputValues
		if (!iv[id]) iv[id] = {}
		iv[id][no] = value

		this.setState({
			inputValues: iv,
		})
	}
	render() {
		return (
			<div>
				<h1>Manual control</h1>
				{_.map(this.getStudios(), (studio) => {
					return (
						<div key={unprotectString(studio._id)}>
							<h2>{studio.name}</h2>
							<h3 className="mhs">ATEM Control</h3>
							<table>
								<tbody>
									{_.map(this.getAtemMEs(studio), (mapping, mappingLayerId) => {
										return (
											<tr key={mappingLayerId}>
												<th>{mappingLayerId}</th>
												{_.map([1, 2, 3, 4, 5, 6, 7, 8], (cam) => {
													return (
														<td key={cam}>
															<button
																className="btn btn-primary"
																onClick={(e) => this.atemCamera(studio, mappingLayerId, cam)}>
																Camera {cam}
															</button>
														</td>
													)
												})}
											</tr>
										)
									})}
								</tbody>
							</table>
							<h3 className="mhs">CasparCG Control</h3>
							<table>
								<tbody>
									{_.map(this.getManualLayers(studio), (mapping, mappingLayerId) => {
										if (mappingIsCasparCG(mapping)) {
											return (
												<tr key={mappingLayerId}>
													<th>{mappingLayerId}</th>
													<td>
														<button
															className="btn btn-primary"
															onClick={(e) => this.casparcgPlay(studio, mappingLayerId)}>
															Caspar Play
														</button>
														<button
															className="btn btn-primary"
															onClick={(e) => this.casparcgClear(studio, mappingLayerId)}>
															Clear
														</button>
													</td>
													<td>
														<EditAttribute
															updateFunction={(_edit, value) => this.onInputChange(mappingLayerId, 'file', value)}
															type="text"
															overrideDisplayValue={this.state.inputValues[mappingLayerId]}
														/>
													</td>
												</tr>
											)
										} else if (mappingIsQuantel(mapping)) {
											return (
												<tr key={mappingLayerId}>
													<th>{mappingLayerId}</th>
													<td>
														<button
															className="btn btn-primary"
															onClick={(e) => this.quantelPlay(studio, mappingLayerId)}>
															Quantel Play
														</button>
														<button
															className="btn btn-primary"
															onClick={(e) => this.quantelClear(studio, mappingLayerId)}>
															Clear
														</button>
													</td>
													<td>
														<EditAttribute
															updateFunction={(_edit, value) => this.onInputChange(mappingLayerId, 'title', value)}
															type="text"
															overrideDisplayValue={(this.state.inputValues[mappingLayerId] || {}).title}
														/>
													</td>
													<td>
														<EditAttribute
															updateFunction={(_edit, value) => this.onInputChange(mappingLayerId, 'guid', value)}
															type="text"
															overrideDisplayValue={(this.state.inputValues[mappingLayerId] || {}).guid}
														/>
													</td>
												</tr>
											)
										}
										return null
									})}
								</tbody>
							</table>
						</div>
					)
				})}
			</div>
		)
	}
}
