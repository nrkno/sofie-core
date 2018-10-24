import { Meteor } from 'meteor/meteor'
import { getPD } from './mosData'
import {
	MosString128
} from 'mos-connection'

import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PeripheralDevices, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { literal } from '../../lib/lib'
import { logger } from '../logging'
import * as _ from 'underscore'
import { setMeteorMethods } from '../methods'

setMeteorMethods({
	'debug_roMock4' () {
		let pd = getPD()
		if (!pd) {
			throw new Meteor.Error(404, 'MOS Device not found to be used for mock running order!')
		}
		let id = pd._id
		let token = pd.token
		logger.info('debug_roMock3')

		Meteor.call(PeripheralDeviceAPI.methods.mosRoDelete, id, token,
			new MosString128('SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E84'))
		//
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, id, token,
			{
				'ID' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E84',
				'Slug' : 'PTZ Test Harness',
				'EditorialStart' : '2018-09-07T07:00:00,000Z',
				'EditorialDuration' : '0:9:0',
				'MosExternalMetaData' : [
					{
						'MosSchema' : 'http://SLENPS01:10505/schema/enpsro.dtd',
						'MosPayload' : {
							'AllowExternalMod' : 1,
							'EndTime' : '2018-09-07T07:09:00',
							'MOSroBlock' : 'VIZ.DKOA.MOS;VIZ.NPRO.MOS;VIZ.TPRO.MOS',
							'MOSROStatus' : 'PLAY',
							'MOSROStatusMOS' : 'MOSART1.NDSL.MOS',
							'MOSROStatusTime' : '2018-05-14T11:21:13',
							'MOSroStorySend' : 'DPE01.NRK.MOS;OMNIBUS.NDSL.STORYMOS;SOFIE1.DKSL.MOS',
							'ProgramName' : 'DKSL TV 1850',
							'RundownDuration' : '09:00',
							'StartTime' : '2018-09-07T07:00:00',
							'AnsvRed' : 'DKSL',
							'AutoArchiveClips' : 1,
							'Clipnames' : 'Klipp 1;\\Klipp 2;\\Klipp 3;\\Klipp 4;',
							'Kanal' : 'NRK1',
							'ProdNr' : 'DKSL99090618',
							'Regionalsend' : 'SL',
							'LocalStartTime' : '2018-09-07T07:00:00',
							'ENPSItemType' : 2,
							'roLayout' : 'PageNum_450|RowStatus_150|Slug_1920|SegStatus_210|Segment_2595|mosartType_1110|mosartVariant_1290|mosartTransition_825|ip1_460|ip2_535|MOSObjSlugs_8295|Estimated_555|Actual_570|MOSItemDurations_630|Float_600|Tekniske-opplysninger_1875|FrontTime_1005|ElapsedTime_1000'
						},
						'MosScope' : 'PLAYLIST'
					}
				],
				'Stories' : [
					{
						'ID': 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E84;28C8BD26-1616-4E04-A6B9442280AF352A',
						'Slug': 'GJEST;Intro',
						'Items': [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E84;0E405892-E8E0-418A-A57DA3FE0A48FE45',
						'Slug' : 'GJEST;GJEST-',
						'Items' : [
						]
					}
				]
			}
		)
		_.each(stories, (story) => {
			Meteor.call(PeripheralDeviceAPI.methods.mosRoFullStory, id, token, story)
		})
	}
})

const stories = [{

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E84;28C8BD26-1616-4E04-A6B9442280AF352A',
	'Slug' : 'GJEST;Intro',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 5,
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101613Z',
				'MOSObjSlugs' : 'Story status',
				'MOSSlugs' : 'NYHETSSAK 1;Studio med baksjkerm-7',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'TextTime' : 0,
				'mosartType' : 'KAM',
				'mosartVariant': '1',
				'PTZ' : 1,
				'ReadTime' : 0,
				'ENPSItemType' : 3,
				'mosartTransition' : 'effect 3'
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E84',
	'Body' : [
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '2',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'NYHETSSAK 1;Studio med baksjkerm-7',
				'mosAbstract' : 'TIDSMARKØR IKKE RØR',
				'ObjectSlug' : 'Story status'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		}
	]
},{

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E84;0E405892-E8E0-418A-A57DA3FE0A48FE45',
	'Slug' : 'GJEST;GJEST-',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 30,
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101750Z',
				'MOSItemDurations' : '16,84\r\n22,16',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'M: \r\n202 Bilde (Manual/OnNext): Grøvan på E39-plan\r\n01 navn|Ett navn (00:05, Manual/Auto): Nina Markenes, ekspert\r\nSKOFTERUD-030918S-SL\r\nOSCARKANDIDAT-040918S-SL\r\n01 navn|Ett navn (00:05, Manual/Auto)Story status',
				'MOSSlugs' : 'Uten tittel\r\nGJEST;gjest--7\r\nGJEST;gjest--8\r\nGJEST;GJEST--8\r\nGJEST;GJEST--9\r\nGJEST;GJEST--5\r\nNYHETSSAK 1;Studio med baksjkerm-7',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'StoryLogPreview' : '<BAK><  >',
				'TextTime' : 0,
				'Bildebeskrivelse' : '',
				'mosartType' : 'KAM',
				'mosartVariant' : '1',
				'PTZ' : 2,
				'ReadTime' : 0,
				'Rettigheter' : 'Grønt',
				'Rettighetseier' : 'NRK',
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E84',
	'Body' : [
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '3',
				'ObjectID' : 'N12050_1535535332',
				'MOSID' : 'METADATA.NRK.MOS',
				'Slug' : 'Uten tittel',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://mosA4.com/mos/supported_schemas/MOSAXML2.08',
						'MosPayload' : {
							'nrk' : {
								'attributes' : {
									'changetime' : '2018-08-29T11:35:32 +02:00',
									'changedBy' : 'N12050',
									'type' : 'video',
									'mdSource' : 'ncs'
								},
								'title' : '',
								'description' : '',
								'hbbtv' : {
									'link' : ''
								},
								'rights' : {
									'text' : 'Green',
									'notes' : '',
									'owner' : 'NRK'
								}
							}
						}
					}
				],
				'mosAbstract' : 'METADATA',
				'ObjectSlug' : 'M:'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : '<BAK><',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '6',
				'ObjectID' : '09f0925a-3318-49b7-bd88-fa8eb4f48344',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'GJEST;gjest--7',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'd1867851-85b6-4191-a2ae-cd034d853a94',
							'metadata' : {
								'modul' : 'nora.module.browser',
								'selection' : {
									'Design' : {
										'displayName' : 'Nyheter',
										'path' : 'http://nora.render.nyheter.mesosint.nrk.no'
									},
									'Type' : {
										'displayName' : 'bakskjerm',
										'path' : 'bakskjerm'
									},
									'Mal' : {
										'displayName' : '202 Bilde',
										'path' : '202_bilde'
									}
								},
								'name' : {
									'time' : '(Manual/OnNext)',
									'templateName' : '202 Bilde',
									'templateVariant' : '',
									'content' : 'Grøvan på E39-plan',
									'full' : '202 Bilde (Manual/OnNext): Grøvan på E39-plan'
								},
								'type' : 'bakskjerm',
								'userContext' : {
									'text' : '2018-09-06-T10:46:24',
									'changed' : '2018-09-06-T10:46:24'
								}
							},
							'template' : {
								'channel' : 'gfx3',
								'system' : 'html',
								'name' : '202_bilde',
								'layer' : 'bakskjerm'
							},
							'content' : {
								'_valid' : true,
								'bilde' : {
									'creators' : 'Svein Sundsdal (billedmontasje: Pål Tegnander)',
									'credit' : '',
									'title' : 'Grøvan på E39-plan',
									'w' : 1,
									'format' : 'image/jpeg',
									'width' : 1920,
									'text' : 0,
									'x' : 0,
									'h' : 0.8741259,
									'y' : 0.012937063,
									'id' : 'wLeX2o01fVUnTX9gBdhhJA',
									'type' : 'image/jpeg',
									'uri' : 'wLeX2o01fVUnTX9gBdhhJA7ZjftCamhkD9xF8NFQZo5g',
									'quality' : 0.9,
									'height' : 1080,
									'url' : 'https://gfx.nrk.no/wLeX2o01fVUnTX9gBdhhJA7ZjftCamhkD9xF8NFQZo5g'
								}
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'out' : 'onNext',
							'text' : 0,
							'timeIn' : 0,
							'duration' : 5000,
							'in' : 'manual'
						}
					}
				],
				'mosAbstract' : '202 Bilde (Manual/OnNext): Grøvan på E39-plan'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : '>',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '7',
				'ObjectID' : '0c2a5e79-8281-43ad-9efd-7cc5f53d2641',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'GJEST;gjest--8',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '1f9e1615-5fcf-4df6-86df-d47527d6efb6',
							'metadata' : {
								'modul' : 'nora.module.browser',
								'selection' : {
									'Design' : {
										'displayName' : 'Nyheter',
										'path' : 'http://nora.render.nyheter.mesosint.nrk.no'
									},
									'Type' : {
										'displayName' : 'super',
										'path' : 'super'
									},
									'Mal' : {
										'displayName' : '01 Navn: Ett navn',
										'path' : '01_navn'
									}
								},
								'name' : {
									'time' : '(00:05, Manual/Auto)',
									'templateName' : '01 navn',
									'templateVariant' : 'Ett navn',
									'content' : 'Nina Markenes, ekspert',
									'full' : '01 navn|Ett navn (00:05, Manual/Auto): Nina Markenes, ekspert'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T10:49:06',
									'changed' : '2018-09-06-T10:49:06'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '01_navn',
								'layer' : 'super'
							},
							'content' : {
								'_valid' : true,
								'navn' : 'Nina Markenes',
								'tittel' : 'ekspert'
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'text' : 0,
							'timeIn' : 0,
							'duration' : 5000,
							'in' : 'manual',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '01 navn|Ett navn (00:05, Manual/Auto): Nina Markenes, ekspert'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : '<BTS><',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '8',
				'ObjectID' : '\\\\NDSL\\Omn\\D\\C\\08\\71',
				'MOSID' : 'OMNIBUS.NDSL.MOS',
				'Slug' : 'GJEST;GJEST--8',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'OMNIBUS',
						'MosPayload' : {
							'title' : 'SKOFTERUD-030918S-SL',
							'objectType' : 'CLIP',
							'clipType' : 'NYHETER_STK',
							'objDur' : 842,
							'objType' : 'VIDEO'
						}
					}
				],
				'mosAbstract' : 'SKOFTERUD-030918S-SL NYHETER_STK 00:00:16:21',
				'ObjectSlug' : 'SKOFTERUD-030918S-SL',
				'Duration' : 842,
				'TimeBase' : 50
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : '>',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : '<BTS><',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '9',
				'ObjectID' : '\\\\NDSL\\Omn\\D\\C\\10\\23',
				'MOSID' : 'OMNIBUS.NDSL.MOS',
				'Slug' : 'GJEST;GJEST--9',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'OMNIBUS',
						'MosPayload' : {
							'title' : 'OSCARKANDIDAT-040918S-SL',
							'objectType' : 'CLIP',
							'clipType' : 'NYHETER',
							'objDur' : 1108,
							'objType' : 'VIDEO'
						}
					}
				],
				'mosAbstract' : 'OSCARKANDIDAT-040918S-SL NYHETER 00:00:22:04',
				'ObjectSlug' : 'OSCARKANDIDAT-040918S-SL',
				'Duration' : 1108,
				'TimeBase' : 50
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : '>',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : '<BTS><RM1>',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : '<BTS>RM2',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '5',
				'ObjectID' : '808cce6f-0ad8-4a59-ab5d-71f776752d87',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'GJEST;GJEST--5',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'aefd28d5-a151-4514-9e51-7df0d80b56c3',
							'metadata' : {
								'modul' : 'nora.module.browser',
								'selection' : {
									'Design' : {
										'displayName' : 'Nyheter',
										'path' : 'http://nora.render.nyheter.mesosint.nrk.no'
									},
									'Type' : {
										'displayName' : 'super',
										'path' : 'super'
									},
									'Mal' : {
										'displayName' : '01 Navn: Ett navn',
										'path' : '01_navn'
									}
								},
								'name' : {
									'time' : '(00:05, Manual/Auto)',
									'templateName' : '01 navn',
									'templateVariant' : 'Ett navn',
									'content' : '',
									'full' : '01 navn|Ett navn (00:05, Manual/Auto)'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-08-30-T17:26:50',
									'changed' : '2018-08-30-T17:26:50'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '01_navn',
								'layer' : 'super'
							},
							'content' : {
								'_valid' : false,
								'navn' : '',
								'tittel' : ''
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'text' : 0,
							'timeIn' : 0,
							'duration' : 5000,
							'in' : 'manual',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '01 navn|Ett navn (00:05, Manual/Auto)'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '2',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'NYHETSSAK 1;Studio med baksjkerm-7',
				'mosAbstract' : 'TIDSMARKØR IKKE RØR',
				'ObjectSlug' : 'Story status'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		}
	]
}]
