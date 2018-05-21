
import * as _ from 'underscore'

import {
	IMOSConnectionStatus,
	IMOSDevice,
	IMOSListMachInfo,
	MosString128,
	MosTime,
	IMOSRunningOrder,
	IMOSRunningOrderBase,
	IMOSRunningOrderStatus,
	IMOSStoryStatus,
	IMOSItemStatus,
	IMOSStoryAction,
	IMOSROStory,
	IMOSROAction,
	IMOSItemAction,
	IMOSItem,
	IMOSROReadyToAir,
	IMOSROFullStory,
	IMOSStory,
	IMOSExternalMetaData,
	IMOSROFullStoryBodyItem
} from 'mos-connection'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines, DBSegmentLine } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems, ITimelineTrigger } from '../../../lib/collections/SegmentLineItems'
import { TriggerType } from 'superfly-timeline'
import { RundownAPI } from '../../../lib/api/rundown'
import { IOutputLayer,
	ISourceLayer
} from '../../../lib/collections/StudioInstallations'
import {
	TemplateFunction,
	TemplateSet,
	SegmentLineItemOptional,
	TemplateFunctionOptional,
	TemplateResult,
	TemplateContextInner,
	StoryWithContext
} from './templates'
import {
	TimelineObjCCGVideo,
	TimelineObjLawoSource,
	TimelineObjCCGTemplate,
	TimelineContentTypeCasparCg,
	TimelineContentTypeLawo,
	TimelineContentTypeAtem,
	TimelineObj,
	TimelineObjAbstract,
	Atem_Enums,
	TimelineObjAtemME,
	TimelineObjAtemAUX,
	TimelineObjAtemDSK,
	TimelineObjAtemSsrc
} from '../../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../../lib/constants/casparcg'
import { Optional } from '../../../lib/lib'

const literal = <T>(o: T) => o

// ------------------------------
// Temporary notes:
// Layer setup:
/*
let outputLayers: Array<IOutputLayer> = [
	{
		_id: 'pgm0',
		name: 'PGM',
		isPGM: true,
	},
	{
		_id: 'monitor0',
		name: 'Skjerm',
		isPGM: false,
	}
]

/*
Caspar Channels:
1: [CServ1] Fill, Primary Video channel
	+ sound
2: [CServ_PVW] Fill, Video channel for preview (usage TBD)
	+ sound
3: [Serv2] Key + Fill, Studio-screen?
	+ no sound
4: [CG1] Fill + Key, Graphics (DSK1)
	+ no sound
5: [CG2] Fill + Key, Video / Graphics (DSK2)
	+ sound, effect sounds

Fill: Video (comes as a camera)
	+ sound
Key + Fill: graphics / video to be keyed onto PGM
	+ sound

let sourceLayers = [

	// on top of PGM, to be keyed
	{ _id: 'vignett', 	name: 'Vignett', 	type: RundownAPI.SourceLayerType.LIVE_SPEAK,unlimited: true, 	onPGMClean: false},
	{ _id: 'vignett', 	name: 'Vignett', 	type: RundownAPI.SourceLayerType.LIVE_SPEAK,unlimited: true, 	onPGMClean: false},
	{ _id: 'live-speak0', 	name: 'STK', 	type: RundownAPI.SourceLayerType.LIVE_SPEAK, 	unlimited: true, 	onPGMClean: false},
	{ _id: 'lower-third0', 	name: 'Super', 	type: RundownAPI.SourceLayerType.LOWER_THIRD, 	unlimited: true, 	onPGMClean: false},
	{ _id: 'graphics0', 	name: 'GFX', 	type: RundownAPI.SourceLayerType.GRAPHICS, 		unlimited: true, 	onPGMClean: false},
	{ _id: 'remote0', 		name: 'RM1', 	type: RundownAPI.SourceLayerType.REMOTE, 		unlimited: false, 	onPGMClean: true},
	{ _id: 'vt0', 			name: 'VB', 	type: RundownAPI.SourceLayerType.VT, 			unlimited: true, 	onPGMClean: true},
	{ _id: 'mic0', 			name: 'Mic', 	type: RundownAPI.SourceLayerType.MIC, 			unlimited: false, 	onPGMClean: true},
	{ _id: 'camera0', 		name: 'Kam', 	type: RundownAPI.SourceLayerType.CAMERA, 		unlimited: false, 	onPGMClean: true},
]
*/
enum LLayers {
	casparcg_player_vignett = 'casparcg_player_vignett',
	casparcg_player_clip = 'casparcg_player_clip',
	lawo_source_effect = 'lawo_source_effect',
	lawo_source_automix = 'lawo_source_automix',
	lawo_source_clip = 'lawo_source_clip',
	atem_me_program = 'atem_me_program',
	casparcg_player_wipe = 'casparcg_player_wipe',
	casparcg_player_soundeffect = 'casparcg_player_soundeffect',
}

// -------------------------------
// The template set:
let nrk: TemplateSet = {
	/**
	 * Returns the id of the template-function to be run
	 * @param story
	 */
	getId: literal<TemplateSet['getId']>(function (context, story): string {
		let templateId = ''

		if (story.MosExternalMetaData) {
			_.find(story.MosExternalMetaData, (md) => {
				if (
					md.MosScope === 'PLAYLIST' &&
					md.MosSchema.match(/10505\/schema\/enps.dtd/)
				) {
					let type = md.MosPayload.mosartType + ''
					let variant = md.MosPayload.mosartVariant + ''

					if (type.match(/break/i)) 			templateId = 'break'
					// else if (type.match(/full/i) &&
					// 		!variant)			 		templateId = 'full'
					else if (type.match(/full/i) &&
							variant.match(/vignett/i)) 	templateId = 'vignett'
					else if (type.match(/stk/i) &&
							variant.match(/head/i)) 	templateId = 'stkHead'
					else if (type.match(/kam/i)) 		templateId = 'kam'
				}
				if (templateId) return true // break
				else return false // keep looking
			})
		}
		console.log('getId', templateId)
		return templateId
	}),
	templates: {
		/**
		 * BREAK
		 */
		break: literal<TemplateFunctionOptional>((context, story): TemplateResult => {
			return {
				segmentLine: literal<DBSegmentLine>({
					_id: '',
					_rank: 0,
					mosId: '',
					segmentId: '',
					runningOrderId: '',
					slug: 'BREAK',
				}),
				segmentLineItems: [
					literal<SegmentLineItemOptional>({
						_id: '',
						mosId: '',
						segmentLineId: '',
						runningOrderId: '',
						name: 'BREAK',
						trigger: {
							type: TriggerType.TIME_ABSOLUTE,
							value: 'now'
						},
						status: RundownAPI.LineItemStatusCode.OK,
						sourceLayerId: 'studio0_vignett',
						outputLayerId: 'pgm0',
						expectedDuration: 0,
						content: {
							timelineObjects: [
								// Default timeline
								literal<TimelineObjAtemME>({
									_id: '', deviceId: [''], siId: '', roId: '',
									trigger: { type: TriggerType.LOGICAL, value: '1' },
									priority: -1, duration: 0,
									LLayer: 'atem_me_program',
									content: {
										type: TimelineContentTypeAtem.ME,
										// transitions?: {
										//     inTransition?: TimelineTransition
										// }
										attributes: {
											input: 1, // to be changed?
											transition: Atem_Enums.TransitionStyle.CUT
										}
									}
								}),
								literal<TimelineObjAtemME>({
									_id: '', deviceId: [''], siId: '', roId: '',
									trigger: { type: TriggerType.LOGICAL, value: '1' },
									priority: -1, duration: 0,
									LLayer: 'atem_me_studiomonitor',
									content: {
										type: TimelineContentTypeAtem.ME,
										// transitions?: {
										//     inTransition?: TimelineTransition
										// }
										attributes: {
											input: 16,
											transition: Atem_Enums.TransitionStyle.CUT
										}
									}
								}),
								literal<TimelineObjAtemAUX>({
									_id: '', deviceId: [''], siId: '', roId: '',
									trigger: { type: TriggerType.LOGICAL, value: '1' },
									priority: -1, duration: 0,
									LLayer: 'atem_aux_clean',
									content: {
										type: TimelineContentTypeAtem.AUX,
										// transitions?: {
										//     inTransition?: TimelineTransition
										// }
										attributes: {
											input: Atem_Enums.SourceIndex.Cfd1
										}
									}
								}),
								literal<TimelineObjAtemAUX>({
									_id: '', deviceId: [''], siId: '', roId: '',
									trigger: { type: TriggerType.LOGICAL, value: '1' },
									priority: -1, duration: 0,
									LLayer: 'atem_aux_preview',
									content: {
										type: TimelineContentTypeAtem.AUX,
										// transitions?: {
										//     inTransition?: TimelineTransition
										// }
										attributes: {
											input: Atem_Enums.SourceIndex.Prv1
										}
									}
								}),
								literal<TimelineObjAtemDSK>({
									_id: '', deviceId: [''], siId: '', roId: '',
									trigger: { type: TriggerType.LOGICAL, value: '1' },
									priority: -1, duration: 0,
									LLayer: 'atem_dsk_graphics',
									content: {
										type: TimelineContentTypeAtem.DSK,
										// transitions?: {
										//     inTransition?: TimelineTransition
										// }
										attributes: {
											onAir: true,
											fillSource: 10,
											keySource: 11
										}
									}
								}),
								literal<TimelineObjAtemDSK>({
									_id: '', deviceId: [''], siId: '', roId: '',
									trigger: { type: TriggerType.LOGICAL, value: '1' },
									priority: -1, duration: 0,
									LLayer: 'atem_dsk_effect',
									content: {
										type: TimelineContentTypeAtem.DSK,
										// transitions?: {
										//     inTransition?: TimelineTransition
										// }
										attributes: {
											onAir: true,
											fillSource: 12,
											keySource: 13
										}
									}
								}),
								literal<TimelineObjAtemSsrc>({
									_id: '', deviceId: [''], siId: '', roId: '',
									trigger: { type: TriggerType.LOGICAL, value: '1' },
									priority: -1, duration: 0,
									LLayer: 'atem_dsk_effect',
									content: {
										type: TimelineContentTypeAtem.SSRC,
										// transitions?: {
										//     inTransition?: TimelineTransition
										// }
										attributes: {
											boxes: [
												{
													enabled: true,
													source: 1
												},
												{
													enabled: true,
													source: 4
												}
											],
											artfillSource: 16
										}
									}
								}),
								literal<TimelineObjLawoSource>({
									_id: '', deviceId: [''], siId: '', roId: '',
									trigger: { type: TriggerType.LOGICAL, value: '1' },
									priority: -1, duration: 0,
									LLayer: 'lawo_source_automix',
									content: {
										type: TimelineContentTypeLawo.AUDIO_SOURCE,
										attributes:{
											db: -191
										}
									}
								}),
								literal<TimelineObjLawoSource>({
									_id: '', deviceId: [''], siId: '', roId: '',
									trigger: { type: TriggerType.LOGICAL, value: '1' },
									priority: -1, duration: 0,
									LLayer: 'lawo_source_clip',
									content: {
										type: TimelineContentTypeLawo.AUDIO_SOURCE,
										attributes:{
											db: -191
										}
									}
								}),
								literal<TimelineObjLawoSource>({
									_id: '', deviceId: [''], siId: '', roId: '',
									trigger: { type: TriggerType.LOGICAL, value: '1' },
									priority: -1, duration: 0,
									LLayer: 'lawo_source_effect',
									content: {
										type: TimelineContentTypeLawo.AUDIO_SOURCE,
										attributes:{
											db: -191
										}
									}
								}),
								literal<TimelineObjLawoSource>({
									_id: '', deviceId: [''], siId: '', roId: '',
									trigger: { type: TriggerType.LOGICAL, value: '1' },
									priority: -1, duration: 0,
									LLayer: 'lawo_source_preview',
									content: {
										type: TimelineContentTypeLawo.AUDIO_SOURCE,
										attributes:{
											db: 0
										}
									}
								}),
								literal<TimelineObjCCGTemplate>({
									_id: '', deviceId: [''], siId: '', roId: '',
									trigger: { type: TriggerType.LOGICAL, value: '1' },
									priority: -1, duration: 0,
									LLayer: 'casparcg_cg_graphics',
									content: {
										type: TimelineContentTypeCasparCg.TEMPLATE,
										attributes:{
											name: 'http://design-nyheter.mesosint.nrk.no/?group=DKKristiansand&channel=gfx1',
											data: {

											},
											useStopCommand: false
										}
									}
								}),
								literal<TimelineObjCCGTemplate>({
									_id: '', deviceId: [''], siId: '', roId: '',
									trigger: { type: TriggerType.LOGICAL, value: '1' },
									priority: -1, duration: 0,
									LLayer: 'casparcg_cg_logo',
									content: {
										type: TimelineContentTypeCasparCg.TEMPLATE,
										attributes:{
											name: 'http://design-nyheter.mesosint.nrk.no/?group=DKKristiansand&channel=gfx1',
											data: {

											},
											useStopCommand: false
										}
									}
								}),
								literal<TimelineObjCCGTemplate>({
									_id: '', deviceId: [''], siId: '', roId: '',
									trigger: { type: TriggerType.LOGICAL, value: '1' },
									priority: -1, duration: 0,
									LLayer: 'casparcg_cg_studiomonitor',
									content: {
										type: TimelineContentTypeCasparCg.TEMPLATE,
										attributes:{
											name: 'http://design-nyheter.mesosint.nrk.no/?group=DKKristiansand&channel=gfx2',
											data: {

											},
											useStopCommand: false
										}
									}
								})
							]
						}
					})
					// literal<SegmentLineItemOptional>({
					// 	_id: '',
					// 	mosId: '',
					// 	segmentLineId: '',
					// 	runningOrderId: '',
					// 	name: 'AMB',
					// 	trigger: {
					// 		type: TriggerType.TIME_ABSOLUTE,
					// 		value: 0
					// 	},
					// 	status: RundownAPI.LineItemStatusCode.OK,
					// 	sourceLayerId: 'studio0_vignett',
					// 	outputLayerId: 'pgm0',
					// 	expectedDuration: 100000,
					// 	content: {
					// 		fileName: 'AMB',
					// 		sourceDuration: 100000,
					// 		timelineObjects: [
					// 			literal<TimelineObjCCGVideo>({
					// 				_id: 'AMB', deviceId: [''],
					// 				siId: '',roId: '',
					// 				trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
					// 				priority: 0,
					// 				duration: 100000,
					// 				LLayer: 'casparcg_player_vignett',
					// 				content: {
					// 					type: TimelineContentTypeCasparCg.VIDEO,
					// 					attributes: {
					// 						file: 'AMB',
					// 						loop: true
					// 					}
					// 				}
					// 			})
					// 		]
					// 	}
					// })
				]
			}
		}),

		/**
		 * VIGNETT
		 */
		vignett: literal<TemplateFunctionOptional>(function (context, story) {
			let clip: string = ''
			let sourceDuration: number = 0
			let segmentLineduration: number = 0

			// selects correct vignett clip file and sets the assosciated hard coded durations to match
			let mosartVariant = story.getValueByPath('MosExternalMetaData.0.MosPayload.mosartVariant', 'VIGNETT')
			switch (mosartVariant) {
				case 'VIGNETT2018':
					// lengths and times are milliseconds
					clip = 'vignett'	// @todo TBD
					sourceDuration = 40	* 1000	// @todo TBD
					segmentLineduration = 4 * 1000	// @todo TBD
					break
			}

			let segmentLineItems: Array<SegmentLineItemOptional> = []
			let IDs = {
				lawo: context.getHashId('lawo'),
				vignett: context.getHashId('vignett')
			}

			let video: SegmentLineItemOptional = {
				_id: context.getHashId('vignett'),
				mosId: 'vignett',
				name: 'Vignett',
				trigger: {
					type: TriggerType.TIME_ABSOLUTE,
					value: 0
				},
				status: RundownAPI.LineItemStatusCode.UNKNOWN,
				sourceLayerId: 'studio0_vignett',
				outputLayerId: 'pgm0',
				expectedDuration: segmentLineduration,
				content: {
					fileName: clip,
					sourceDuration: sourceDuration,
					timelineObjects: [
						// full sound vignett
						literal<TimelineObjLawoSource>({
							_id: IDs.lawo, deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
							priority: 0,
							duration: 0,
							LLayer: LLayers.lawo_source_effect,
							content: {
								type: TimelineContentTypeLawo.AUDIO_SOURCE,
								attributes: {
									db: 0
								}
							}
						}),

						// play vignett over dsk2
						literal<TimelineObjCCGVideo>({
							_id: IDs.vignett, deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo}.start + 0` },
							priority: 0,
							duration: sourceDuration,
							LLayer: LLayers.casparcg_player_vignett,
							content: {
								type: TimelineContentTypeCasparCg.VIDEO,
								attributes: {
									file: clip
								}
							}
						})
					]
				}
			}

			segmentLineItems.push(video)

			return literal<TemplateResult>({
				segmentLine: null,
				segmentLineItems: segmentLineItems
			})
		}),

		/**
		 * STK HEAD
		 */
		stkHead: literal<TemplateFunctionOptional>(function (context, story) {
			let IDs = {
				lawo_automix: 		context.getHashId('lawo_automix'),
				lawo_effect: 		context.getHashId('lawo_effect'),
				headVideo: 			context.getHashId('headVideo'),
				atemSrv1: 			context.getHashId('atemSrv1'),
				wipeVideo: 			context.getHashId('wipeVideo'),
				wipeAudioSkille: 	context.getHashId('wipeAudioSkille'),
				wipeAudioPunktum: 	context.getHashId('wipeAudioPunktum'),
				headGfx: 			context.getHashId('headGfx'),
				playerClip: 		context.getHashId('playerClip')
			}
			
			let segmentLines = context.getSegmentLines()
			let segmentLineI = -1
			_.find(segmentLines, (sl: SegmentLine) => {
				segmentLineI++
				return (sl._id === context.segmentLine._id) 
			})
			let isFirstHeadAfterVignett = (segmentLineI === 0)
			let isLastHead = (segmentLineI === segmentLines.length-1)

			

			let storyItemClip = _.find(story.Body, (item) => {
				return (
					item.Type === 'storyItem' &&
					context.getValueByPath(item, 'Content.mosExternalMetadata.0.mosPayload.objectType')
						=== 'CLIP'
				)
			})
			if (!storyItemClip) context.warning('Clip missing in mos data')
			let storyItemGfx = _.find(story.Body, (item) => {
				return (
					item.Type === 'storyItem' &&
					context.getValueByPath(item, 'Content.mosExternalMetadata.0.mosPayload.subtype')
						=== 'lyric/data'
					// context.getValueByPath(item, 'Content.mosID') // for kompatibilitet med ny grafikk
					// === 'GFX.NRK.MOS'
				)
			})
			if (!storyItemGfx) context.warning('Super missing in mos data')

			let clip = context.getValueByPath(storyItemClip, 'Content.myclipNameSomething')	// @todo Missing data in mos

			let segmentLineItems: Array<SegmentLineItemOptional> = []
			let video: SegmentLineItemOptional = {
				_id: context.getHashId('video'),
				mosId: 'headvideo',
				name: 'HeadVideo',
				trigger: {
					type: TriggerType.TIME_ABSOLUTE,
					value: 0
				},
				status: RundownAPI.LineItemStatusCode.UNKNOWN,
				sourceLayerId: 'studio0_live_speak0',
				outputLayerId: 'pgm0',
				expectedDuration: (
					story.getValueByPath('MosExternalMetaData.0.MosPayload.Estimated') ||
					context.sumMosItemDurations(story.getValueByPath('MosExternalMetaData.0.MosPayload.MOSItemDurations')) ||
					story.getValueByPath('MosExternalMetaData.0.MosPayload.MediaTime') ||
					story.getValueByPath('MosExternalMetaData.0.MosPayload.SourceMediaTime') ||
					10
				) * 1000, // transform into milliseconds
				content: {
					fileName: clip,
					sourceDuration: (
						context.getValueByPath(storyItemClip, 'Content.objDur', 0) /
						(context.getValueByPath(storyItemClip, 'Content.objTB') || 1)
					) * 1000,
					timelineObjects: _.compact([

						// mic host hot
						literal<TimelineObjLawoSource>({
							_id: IDs.lawo_automix, deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
							priority: 0,
							duration: 0,
							LLayer: LLayers.lawo_source_automix,
							content: {
								type: TimelineContentTypeLawo.AUDIO_SOURCE,
								transitions: {
									inTransition: {
										type: Transition.MIX,
										duration: 200,
										easing: Ease.LINEAR,
										direction: Direction.LEFT
									}
								},
								attributes: {
									db: 0
								}
							}
						}),

						// audio STK/HEADS -15dB
						literal<TimelineObjLawoSource>({
							_id: IDs.lawo_effect, deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
							priority: 0,
							duration: 0,
							LLayer: LLayers.lawo_source_clip,
							content: {
								type: TimelineContentTypeLawo.AUDIO_SOURCE,
								transitions: {
									inTransition: {
										type: Transition.MIX,
										duration: 200,
										easing: Ease.LINEAR,
										direction: Direction.LEFT
									}
								},
								attributes: {
									db: -15
								}
							}
						}),

						// switch to server1
						literal<TimelineObjAtemME>({
							_id: IDs.atemSrv1, deviceId: [''], siId: '', roId: '',
							trigger: {type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0`},
							priority: 0,
							duration: 0,
							LLayer: LLayers.atem_me_program,
							content: {
								type: TimelineContentTypeAtem.ME,
								attributes: {
									input: 2, // @todo: 14
									transition: Atem_Enums.TransitionStyle.CUT
								}
							}
						}),

						// wipe to head (if not first head after vignett)
						(!isFirstHeadAfterVignett) ? 
						literal<TimelineObjCCGVideo>({
							_id: IDs.wipeVideo, deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
							priority: 0,
							duration: 500,
							LLayer: LLayers.casparcg_player_wipe,
							content: {
								type: TimelineContentTypeCasparCg.VIDEO,
								attributes: {
									file: 'wipe_white'
								}
							}
						}) : null,

						// wipe audio (skille between and punktum for the last)
						(!isLastHead) ?
						literal<TimelineObjCCGVideo>({
							_id: IDs.wipeAudioSkille, deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
							priority: 0,
							duration: 500,
							LLayer: LLayers.casparcg_player_soundeffect,
							content: {
								type: TimelineContentTypeCasparCg.VIDEO,
								attributes: {
									file: 'wipe_audio_skillelyd'
								}
							}
						}) : 
						literal<TimelineObjCCGVideo>({
							_id: IDs.wipeAudioPunktum, deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
							priority: 0,
							duration: 500,
							LLayer: LLayers.casparcg_player_soundeffect,
							content: {
								type: TimelineContentTypeCasparCg.VIDEO,
								attributes: {
									file: 'wipe_audio_punktum'
								}
							}
						}),

						// play HEAD
						literal<TimelineObjCCGVideo>({
							_id: IDs.playerClip, deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
							priority: 0,
							duration: (
								context.getValueByPath(storyItemClip, 'Content.objDur', 0) /
								(context.getValueByPath(storyItemClip, 'Content.objTB') || 1)
							) * 1000,
							LLayer: 'casparcg_player_clip',
							content: {
								type: TimelineContentTypeCasparCg.VIDEO,
								attributes: {
									file: clip
								}
							}
						})
					])
				}
			}
			segmentLineItems.push(video)

			let trigger: ITimelineTrigger = {
				type: TriggerType.TIME_ABSOLUTE,
				value: 0
			}
			let triggerType = context.getValueByPath(storyItemGfx, 'Content.mosExternalMetadata.0.mosPayload.trigger','') + ''
			let outType = context.getValueByPath(storyItemGfx, 'Content.mosExternalMetadata.0.mosPayload.out','')

			let mosInTime = (parseFloat(context.getValueByPath(storyItemGfx, 'Content.mosExternalMetadata.0.mosPayload.in',0)) || 0)
			let mosDuration = (parseFloat(context.getValueByPath(storyItemGfx, 'Content.mosExternalMetadata.0.mosPayload.duration',0)) || 0 )

			if (triggerType.match(/auto/i)) {
				trigger = {
					type: TriggerType.TIME_RELATIVE,
					value: `#${video._id}.start + ${mosInTime}`
				}
			} else if (triggerType.match(/manual/i)) {
				// @todo: how to handle this?
				// probably create a new segmentline?
				trigger = {
					type: TriggerType.TIME_RELATIVE,
					value: `#${video._id}.start + 0`
				}
			} else {
				context.warning('Unknown trigger: "' + triggerType + '"')
			}

			let gfx: SegmentLineItemOptional = {
				_id: context.getHashId('super'),
				mosId: 'super',
				name: 'Super',
				trigger: trigger,
				status: RundownAPI.LineItemStatusCode.UNKNOWN,
				sourceLayerId: 'studio0_graphics0',
				outputLayerId: 'pgm0',
				expectedDuration: 8 * 1000, // @todo TBD
				content: {
					fileName: clip,
					sourceDuration: 8 * 1000, // @todo TBD
					timelineObjects: [
						literal<TimelineObjCCGTemplate>({ // to be changed to NRKPOST-something
							_id: IDs.headGfx, deviceId: [''], siId: '', roId: '',
							trigger: {
								type: TriggerType.TIME_RELATIVE,
								value: `#${IDs.headVideo}.start + 5`
							},
							priority: 0,
							duration: 8 * 1000, // @todo TBD
							LLayer: 'casparcg_cg_graphics',
							content: {
								type: TimelineContentTypeCasparCg.TEMPLATE, // to be changed to NRKPOST-something
								attributes: {
									name: 'nrkgfx', // @todo: TBD
									useStopCommand: false
								}
							}
						})
					]
				}
			}
			segmentLineItems.push(gfx)

			return literal<TemplateResult>({
				segmentLine: null,
				segmentLineItems: segmentLineItems
			})
		}),
		/**
		 * KAM
		 */
		kam: literal<TemplateFunctionOptional>((context: TemplateContextInner, story): TemplateResult => {
			
			let cameraInput = 0
			let mosartVariant = story.getValueByPath('MosExternalMetaData.0.MosPayload.mosartVariant', '')
			if (mosartVariant) {
				cameraInput = parseInt(mosartVariant, 10) || 0
			} else {
				context.warning('mosartVariant for KAM should be the camera to cut to')
			}
			


			return {
				segmentLine: literal<DBSegmentLine>({
					_id: '',
					_rank: 0,
					mosId: '',
					segmentId: '',
					runningOrderId: '',
					slug: 'KAM',
				}),
				segmentLineItems: [
					literal<SegmentLineItemOptional>({
						_id: '',
						mosId: '',
						segmentLineId: '',
						runningOrderId: '',
						name: 'KAM',
						trigger: {
							type: TriggerType.TIME_ABSOLUTE,
							value: 'now'
						},
						status: RundownAPI.LineItemStatusCode.OK,
						sourceLayerId: 'studio0_vignett',
						outputLayerId: 'pgm0',
						expectedDuration: 0,
						content: {
							timelineObjects: _.compact([
								literal<TimelineObjAtemME>({ // to be changed to NRKPOST-something
									_id: context.getHashId('atem_me0'), deviceId: [''], siId: '', roId: '',
									trigger: {
										type: TriggerType.TIME_ABSOLUTE,
										value: 0
									},
									priority: 0,
									duration: 0, // @todo TBD
									LLayer: 'casparcg_cg_graphics',
									content: {
										type: TimelineContentTypeAtem.ME,
										attributes: {
											input: cameraInput,
											transition: Atem_Enums.TransitionStyle.CUT
										}
									}
								})
							])
						}
					})
					
				]
			}
		}),
	}
}

/*
let myTemplates = {
	full (variant, story: IMOSROFullStory): Array<SegmentLineItemOptional> {
		// let video: SegmentLineItemOptional
		if (
			variant === 'vignett'
		) {
		} else {
			let objs: Array<SegmentLineItemOptional> = []
			let storyItem: any = {} // Question: How do I know which storyItem is the one containing the video?
			if (storyItem.Content.mosExternalMetadata.mosPayload.objectType !== 'CLIP') {
				throw Error('Unknown objectType: ' + storyItem.Content.mosExternalMetadata.mosPayload.objectType)
			}
			let timeBase = storyItem.Content.objTB || 0
			let duration = storyItem.Content.objDur || 0
			let video = {
				_id: this.id(),
				mosId: 'video',
				name: 'Video',
				trigger: {
					type: TriggerType.TIME_RELATIVE,
					value: 0
				},
				status: RundownAPI.LineItemStatusCode.UNKNOWN,
				sourceLayerId: '',
				outputLayerId: '',
				expectedDuration: duration * timeBase,
				duration: duration * timeBase,
				content: {
					clip: storyItem.Content.mosExternalMetadata.mosPayload.title, // todo: vignett video file
					mixer: {
						volume: 1
					}
				}
			}
			objs.push(video)

		}
		return objs
	}
}
*/

export {nrk}
/*
Template type  Variant     Lydfil  Hvilke fadere                   Audio level                Effekt      Videoklipp Video xpoint       Beskrivelse
BREAK                                                                                                                None               Make ready for broadcast, put first story in PGM.
FULL                               Videoserver rip                 0                                                 Videoserver rip    Spiller av et innslag med lyd
FULL           VIGNETT     Vignett Lydavspiller                    0                                      Vignett    Videoserver rip    Spiller av vignetten fra videoserver, vignettlyd fra lydavspiller. Har fast lengde til det skal wipes til head eller studio
FULL           VIGNETTxx   Vignett Lydavspiller                    0                                      Vignettxx  Videoserver rip    Spiller av vignetten fra videoserver, vignettlyd fra lydavspiller. Har fast lengde til det skal wipes til head eller studio
STK                                Videoserver rip/mik automiks    −15 on clip, 0 on automix                         Videoserver rip    Play a video clip which the host will speak to. Lower the sound of the video 10 dB
STK            HEAD                Lydavspiller/ mik automiks      0                          Wipe hvit              Videoserver rip    Wipe from vignett to first head with white wipe. Sound is from vignett outro.
STK            HEAD2       Skille  Lydavspiller1+2/ mik automiks   0                          Wipe hvit              Videoserver rip    Wipe from previous head, vignettlyd og skillelyd. Bruker state variant for å kunne skille mellom den som er først i lista og de som kommer etterpå. For bruker er variant på begge HEAD. Forsinkelse på wipe grunnet grafikk
STK            ULYD                Mik automiks                    0                                                 Videoserver rip    Play a video that the host will talk to, but has no sound from the video
KAM            1                   Mik automiks                    0                                                 KAM1               Kamera 1 med mik
KAM            2                   Mik automiks                    0                                                 KAM2               Kamera 2 med mik
KAM            3                   Mik automiks                    0                                                 KAM3               Kamera 3 med mik
KAM            ÅPNING2     Punktum Lydavspiller1+2/ mik automiks   0                          Wipe hvit              KAM2               Wipe fra siste head til kamera. Punktum-lyd til studio. Vignettlyd fades ut.
KAM            GRAFIKK             Mik automiks/ grafikk           0                                                 None               Kamera uten krysspunkt for å legge fullskjermsgrafikk over. Mik og lyd fra grafikk.
KAM            SLUTT1              Mik automiks/ grafikk           0                                                 KAM1               Kamera 1 med mik og fader for grafikk. Dette er for sluttvignett som er en sluttsuper med animasjon til lukking og ender med NRK2018. Sluttvignettlyd ligger på grafikken.
DIR            1                   RM1                             0                                                 RM1                RM1 med lyd
DIR            2                   RM2                             0                                                 RM2                RM2 med lyd
DIR            3                   RM3                             0                                                 RM3                RM3 med lyd

DVE            2LIKE               Automiks/RMx med videolink      0 on automix, -15 on live                         MEx                Innpakket split med to like 16:9 ruter. Venstre henter kilde fra kolonnen ip1, høyre fra kolonnen ip2. Lyd følger de samme kilder. Kamera er gjerne høyre. Grafisk innpakking
GRAFIKK                            Mik automiks/ grafikk           0                                                 Fullskjermsgrafikk Fullskjerms grafikk, som nettpromo, seerbilder etc
TLF            TLF1                Mik automiks/ telefon 1         0                                                 Fullskjermsgrafikk Fullskjermsgrafikk for telefonintervju. Grafikk med mik og telefon lyd
TLF            TLF2                Mik automiks/ telefon 2         0                                                 Fullskjermsgrafikk Fullskjermsgrafikk for telefonintervju. Grafikk med mik og telefon lyd
DIR            RM1                 RM1                             0                                                 RM1                RM1 med lyd..... Annen visning av template variant
DIR            RM2                 RM2                             0                                                 RM2                RM2 med lyd..... Annen visning av template variant
DIR            RM3                 RM3                             0                                                 RM3                RM3 med lyd..... Annen visning av template variant

Special
FULL           VIGNETT
FULL
FULL
STK
DIR

*/
