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

Meteor.methods({
	'debug_roMock3' () {
		let pd = getPD()
		if (!pd) {
			throw new Meteor.Error(404, 'MOS Device not found to be used for mock running order!')
		}
		let id = pd._id
		let token = pd.token
		logger.info('debug_roMock3')

		Meteor.call(PeripheralDeviceAPI.methods.mosRoDelete, id, token,
			new MosString128('SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83'))
		//
		Meteor.call(PeripheralDeviceAPI.methods.mosRoCreate, id, token,
			{
				'ID' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
				'Slug' : 'Julian',
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
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;3DCEB3B7-B62D-4D43-B42A0F8F45BBD4DB',
						'Slug' : 'VIGNETT;Vignett',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;976DAF2B-63F4-4CA4-BE25B872D176F9D3',
						'Slug' : 'VIGNETT;Head 1',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;8F13BCF6-06A4-49AB-B7D8280AC3898855',
						'Slug' : 'VIGNETT;Head 2',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;9744F8EF-77AE-4449-B29AE386C7163AF9',
						'Slug' : 'VIGNETT;Velkommen med super',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;0F53DE12-D16E-407F-ACB8AB6BE7BCCD36',
						'Slug' : 'BYVEKST AVTALE;intro -',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;FEEEAFBB-51F8-4915-9A95F12434C0F55B',
						'Slug' : 'BYVEKST AVTALE;BYVEKST-AVTALE-300818-SL',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;28C8BD26-1616-4E04-A6B9442280AF352A',
						'Slug' : 'GJEST;Intro',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;0E405892-E8E0-418A-A57DA3FE0A48FE45',
						'Slug' : 'GJEST;GJEST-',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;66753E53-519A-4ADF-B353F955B396BC77',
						'Slug' : 'SYKKEL VEI;intro -',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;502BA2D7-79B1-491D-80DF5FE6C67908E8',
						'Slug' : 'SYKKEL VEI;SYKKEL-VEI-310818-SL',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;AA5E11E3-3005-4C20-A90835F8C79BD091',
						'Slug' : 'PADLERE;Kamera - ikke skriv her',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;092CD96C-7080-414F-AA33B6942F5CC07E',
						'Slug' : 'PADLERE;PADLERE-300818S-SL',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;7EE5EE3E-8DB5-453E-97CA8C4F64952B6B',
						'Slug' : 'PADLERE;PADLERE-300818F-SL',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;86F1CD05-E04A-48B4-A93C2DCCFBDD8B8F',
						'Slug' : 'DIREKTE PUNKT FESTIVAL;intro -',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;408A738B-30C6-4528-BB1E30F31BF12AB6',
						'Slug' : 'DIREKTE PUNKT FESTIVAL;PUNKTFESTIVALE-300818S-SL',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;CF823026-A06F-4676-B0809CAD9779E178',
						'Slug' : 'DIREKTE PUNKT FESTIVAL;Split',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;3BD75620-FA60-45E7-88C48E154209C90E',
						'Slug' : 'DIREKTE PUNKT FESTIVAL;Live',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;64A9E81B-4F68-4D56-9DF80DAD1E313A30',
						'Slug' : 'KOMMER 2055;Kamera - ikke skriv her',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;13EE680A-D730-4E6C-B8F95DE7507AB3C9',
						'Slug' : 'KOMMER 2055;STK',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;CBC3F653-D7A8-4E1A-8B9A586BE6EB136B',
						'Slug' : 'KOMMER 2055;SYNK',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;2FCC6FAD-9840-4C4A-B63342930BB64CA2',
						'Slug' : 'SEERBILDE;Kamera - ikke skriv her',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;0300B19A-BCA3-461C-9DE4A0FDAD901D53',
						'Slug' : 'SEERBILDE;SEERBILDE',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;6199E39F-10E5-498C-99D385A66738EB6A',
						'Slug' : 'VÆRET;Kamera - ikke skriv her',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;97E82D60-CC71-4390-AB9765A11985F1AE',
						'Slug' : 'VÆRET;VERET-LØRDAG-310818S-SL',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;C49FF15C-F113-4BD0-B01C4D901A074CC6',
						'Slug' : 'VÆRET;VERET-SØNDAG-310818S-SL',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;C2FEF5F5-AD4D-4BCA-A854A65DD8558F6C',
						'Slug' : 'TAKK FOR IDAG;tekst - takk for nå.',
						'Items' : [
						]
					},
					{
						'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;4D07D9A5-3BA9-4028-BA53A55433792C8B',
						'Slug' : 'TAKK FOR IDAG;SLUTTKREDITT LUKKING',
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
	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;3DCEB3B7-B62D-4D43-B42A0F8F45BBD4DB',
	'Slug' : 'VIGNETT;Vignett',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'Actual' : 7,
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101613Z',
				'MOSItemDurations' : '',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'M: NRK Sørlandet\r\nStory status',
				'MOSSlugs' : 'Uten tittel\r\nVIGNETT;Vign-6',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'StoryLogPreview' : '',
				'TextTime' : 0,
				'Bildebeskrivelse' : '',
				'Innslagstittel' : 'NRK Sørlandet',
				'mosartType' : 'FULL',
				'mosartVariant' : 'VIGNETT',
				'ReadTime' : 0,
				'Rettigheter' : 'Grønt',
				'Rettighetseier' : 'NRK',
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'ID' : '4',
				'ObjectID' : 'N12050_1466085665',
				'MOSID' : 'METADATA.NRK.MOS',
				'Slug' : 'Uten tittel',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://mosA4.com/mos/supported_schemas/MOSAXML2.08',
						'MosPayload' : {
							'nrk' : {
								'attributes' : {
									'changetime' : '2016-06-16T16:01:05 +02:00',
									'changedBy' : 'N12050',
									'type' : 'video',
									'mdSource' : 'ncs'
								},
								'title' : 'NRK Sørlandet',
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
				'mosAbstract' : 'M: NRK Sørlandet (16-06-16 16:01)',
				'ObjectSlug' : 'M: NRK Sørlandet'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : '[Merknad:Lyd fra lydPC]',
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
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'VIGNETT;Vign-6',
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
	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;976DAF2B-63F4-4CA4-BE25B872D176F9D3',
	'Slug' : 'VIGNETT;Head 1',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 8,
				'MediaTime' : 9,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101613Z',
				'MOSItemDurations' : 9,
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'HEAD-BYVEKST-300818S-SL\r\n52 Headline (00:00, Auto/OnNext): Frykter tap av millioner\r\nStory status',
				'MOSSlugs' : 'VIGNETT;HEAD-BYVEKST-300818S-SL-2\r\n52 Headline (00:00, Auto/OnNext): Frykter tap av millioner\r\nVIGNETT;Head 1-18',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'StoryLogPreview' : '(',
				'TextTime' : 0,
				'mosartType' : 'STK',
				'mosartVariant' : 'HEAD',
				'ReadTime' : 9,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'ID' : '2',
				'ObjectID' : '\\\\NDSL\\Omn\\D\\C\\06\\69',
				'MOSID' : 'OMNIBUS.NDSL.MOS',
				'Slug' : 'VIGNETT;HEAD-BYVEKST-300818S-SL-2',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'OMNIBUS',
						'MosPayload' : {
							'title' : 'head-BYVEKST',
							'objectType' : 'CLIP',
							'clipType' : 'NYHETER_STK',
							'objDur' : 450
						}
					}
				],
				'mosAbstract' : 'HEAD-BYVEKST-300818S-SL NYHETER_STK 00:00:09:00',
				'ObjectSlug' : 'HEAD-BYVEKST-300818S-SL',
				'Duration' : 450,
				'TimeBase' : 50
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
				'text' : '(',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : 'Høyre frykter at statlige millioner forsvinner og mener AP har skapt forvirring rundt nye bomstasjoner.',
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
			'Type' : 'p',
			'Content' : {
				'text' : ')',
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
				'ID' : '8',
				'ObjectID' : 'f4597b4b-a90d-4b84-834f-edef80efce4f',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '64845591-b747-4beb-8ac8-a99996c92b50',
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
										'displayName' : '52 Headline',
										'path' : '52_headline'
									}
								},
								'name' : {
									'time' : '(00:00, Auto/OnNext)',
									'templateName' : '52 Headline',
									'templateVariant' : '',
									'content' : 'Frykter tap av millioner',
									'full' : '52 Headline (00:00, Auto/OnNext): Frykter tap av millioner'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T10:44:32',
									'changed' : '2018-09-06-T10:44:32'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '52_headline',
								'layer' : 'headline'
							},
							'content' : {
								'_valid' : true,
								'tagtekst' : 'NRK Sørlandet',
								'headline' : 'Frykter tap av millioner'
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'in' : 'auto',
							'out' : 'onNext',
							'text' : 0,
							'timeIn' : 0,
							'duration' : 5000
						}
					}
				],
				'mosAbstract' : '52 Headline (00:00, Auto/OnNext): Frykter tap av millioner'
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
				'ID' : '3',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'VIGNETT;Head 1-18',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;8F13BCF6-06A4-49AB-B7D8280AC3898855',
	'Slug' : 'VIGNETT;Head 2',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 8,
				'MediaTime' : 13.08,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101613Z',
				'MOSItemDurations' : '13,08',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'HEAD-SYKKELVEI-310818S-SL\r\n52 Headline (00:00, Auto/OnNext): Ny sykkelvei til 80 millioner\r\nStory status',
				'MOSSlugs' : 'VIGNETT;HEAD-SYKKELVEI-310818S-SL-2\r\n52 Headline (00:00, Auto/OnNext): Ny sykkelvei til 80 millioner\r\nVIGNETT;Head 1-18',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'StoryLogPreview' : '(Skriv tekst her:',
				'TextTime' : 7,
				'mosartType' : 'STK',
				'mosartVariant' : 'HEAD',
				'ReadTime' : 20.08,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
	'Body' : [
		{
			'Type' : 'p',
			'Content' : {
				'text' : '(Skriv tekst her:',
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
			'Type' : 'p',
			'Content' : {
				'text' : ')',
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
				'text' : '1100 meter sykkel vei til 87 millioner kroner. Skal få flere til å droppe bilen på vei til jobb.',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : '.',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '2',
				'ObjectID' : '\\\\NDSL\\Omn\\D\\C\\07\\66',
				'MOSID' : 'OMNIBUS.NDSL.MOS',
				'Slug' : 'VIGNETT;HEAD-SYKKELVEI-310818S-SL-2',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'OMNIBUS',
						'MosPayload' : {
							'title' : 'head-sykkelvei',
							'objectType' : 'CLIP',
							'clipType' : 'NYHETER_STK',
							'objDur' : 654
						}
					}
				],
				'mosAbstract' : 'HEAD-SYKKELVEI-310818S-SL NYHETER_STK 00:00:13:02',
				'ObjectSlug' : 'HEAD-SYKKELVEI-310818S-SL',
				'Duration' : 654,
				'TimeBase' : 50
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
				'ID' : '7',
				'ObjectID' : '87f53ce8-8d1c-48e4-8588-95cdea72c27a',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'c4a70c82-d8cd-49f1-97b3-9bf6a67242d7',
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
										'displayName' : '52 Headline',
										'path' : '52_headline'
									}
								},
								'name' : {
									'time' : '(00:00, Auto/OnNext)',
									'templateName' : '52 Headline',
									'templateVariant' : '',
									'content' : 'Ny sykkelvei til 80 millioner',
									'full' : '52 Headline (00:00, Auto/OnNext): Ny sykkelvei til 80 millioner'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T12:00:06',
									'changed' : '2018-09-06-T12:00:06'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '52_headline',
								'layer' : 'headline'
							},
							'content' : {
								'_valid' : true,
								'tagtekst' : 'NRK Sørlandet',
								'headline' : 'Ny sykkelvei til 80 millioner'
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'in' : 'auto',
							'out' : 'onNext',
							'text' : 0,
							'timeIn' : 0,
							'duration' : 5000
						}
					}
				],
				'mosAbstract' : '52 Headline (00:00, Auto/OnNext): Ny sykkelvei til 80 millioner'
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
				'ID' : '3',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'VIGNETT;Head 1-18',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;9744F8EF-77AE-4449-B29AE386C7163AF9',
	'Slug' : 'VIGNETT;Velkommen med super',
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
				'MOSItemDurations' : '',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : '01 navn|Ett navn (00:01=>00:05, Auto/Auto)\r\n50 Logo (00:00, Auto/Manual)\r\n51 Klokke (00:00, Auto/Manual)\r\nStory status',
				'MOSSlugs' : 'VIGNETT;Velkommen med super-13\r\nVIGNETT;Velkommen med super-14\r\nVIGNETT;Velkommen med super-15\r\nVelkommen;Velkommen-5',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'TextTime' : 0,
				'mosartTransition' : '',
				'mosartType' : 'KAM',
				'mosartVariant' : 2,
				'ReadTime' : 0,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '13',
				'ObjectID' : 'bee4f99e-fa52-47d0-844e-4b2594ef6821',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'VIGNETT;Velkommen med super-13',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '64845591-b747-4beb-8ac8-a99996c92b50',
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
									'time' : '(00:01=>00:05, Auto/Auto)',
									'templateName' : '01 navn',
									'templateVariant' : 'Ett navn',
									'content' : '',
									'full' : '01 navn|Ett navn (00:01=>00:05, Auto/Auto)'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-08-30-T17:12:58',
									'changed' : '2018-08-30-T17:12:58'
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
								'navn' : 'Some guy',
								'tittel' : ''
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'timeIn' : 1000,
							'duration' : 5000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '01 navn|Ett navn (00:01=>00:05, Auto/Auto)'
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
				'ID' : '14',
				'ObjectID' : '1855fd91-2e4a-4ac4-8c6d-91d7e7a4d538',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'VIGNETT;Velkommen med super-14',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '64845591-b747-4beb-8ac8-a99996c92b50',
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
										'displayName' : '50 Logo',
										'path' : '50_logo'
									}
								},
								'name' : {
									'time' : '(00:00, Auto/Manual)',
									'templateName' : '50 Logo',
									'templateVariant' : '',
									'content' : '',
									'full' : '50 Logo (00:00, Auto/Manual)'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-08-30-T17:13:13',
									'changed' : '2018-08-30-T17:13:13'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '50_logo',
								'layer' : 'logo'
							},
							'content' : {
								'_valid' : true,
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
							'in' : 'auto',
							'out' : 'manual'
						}
					}
				],
				'mosAbstract' : '50 Logo (00:00, Auto/Manual)'
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
				'ID' : '15',
				'ObjectID' : 'e0b9a20e-b7f5-4d5d-8a73-f5fba4b41603',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'VIGNETT;Velkommen med super-15',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '64845591-b747-4beb-8ac8-a99996c92b50',
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
										'displayName' : '51 Klokke',
										'path' : '51_klokke'
									}
								},
								'name' : {
									'time' : '(00:00, Auto/Manual)',
									'templateName' : '51 Klokke',
									'templateVariant' : '',
									'content' : '',
									'full' : '51 Klokke (00:00, Auto/Manual)'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-08-30-T17:13:20',
									'changed' : '2018-08-30-T17:13:20'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '51_klokke',
								'layer' : 'klokke'
							},
							'content' : {
								'_valid' : true
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
							'in' : 'auto',
							'out' : 'manual'
						}
					}
				],
				'mosAbstract' : '51 Klokke (00:00, Auto/Manual)'
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
				'text' : '<',
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
				'text' : 'Hans Erik Weiby',
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
				'text' : 'Knut Knudsen Eigeland',
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
				'text' : 'Liv Eva Welhaven Løchen',
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
				'text' : 'Siv Kristin Sællmann',
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
				'text' : 'Tom Nicolai Kolstad',
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
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '4',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'Velkommen;Velkommen-5',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;0F53DE12-D16E-407F-ACB8AB6BE7BCCD36',
	'Slug' : 'BYVEKST AVTALE;intro -',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 10,
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101613Z',
				'MOSItemDurations' : '',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : '202 Bilde (Manual/OnNext): Grøvan på E39-plan\r\nStory status',
				'MOSSlugs' : '202 Bilde (Manual/OnNext): Grøvan på E39-plan\r\nNYHETSSAK 1;Studio med baksjkerm-7',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'StoryLogPreview' : 'Kristiansand skal gå fra sju til 18 bomstasjoner. Det blir det bråk av.',
				'TextTime' : 14,
				'mosartType' : 'KAM',
				'mosartVariant' : 2,
				'ReadTime' : 14,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'text' : 'Kristiansand skal gå fra sju til 18 bomstasjoner. Det blir det bråk av.',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : 'Arbeiderpartiet ønsker å få innfridd flere krav før de godtar nye bomstasjoner. Høyre frykter tap av statlige millioner. /S/',
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
				'text' : '<BAK><',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '7',
				'ObjectID' : '09f0925a-3318-49b7-bd88-fa8eb4f48344',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
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
				'ID' : '3',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;FEEEAFBB-51F8-4915-9A95F12434C0F55B',
	'Slug' : 'BYVEKST AVTALE;BYVEKST-AVTALE-300818-SL',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'MediaTime' : 108.56,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101613Z',
				'MOSItemDurations' : '108,56',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'M: Strid om bompengepakke i Kristiansand\r\nBYVEKST-AVTALE-300818-SL\r\n01 navn|Ett navn (00:02=>00:05, Auto/Auto): Anne Wirsching, reporter\r\n01 navn|Ett navn (00:34=>00:05, Auto/Auto): Mette Gundersen, gruppeleder, Arbeiderpartiet, Kristiansand\r\n01 navn|Ett navn (00:18=>00:05, Auto/Auto): Harald Furre, ordfører Kristiansand (H)\r\n24 Foto/Redigering (01:43=>00:05, Auto/Auto): Foto/redigering:, Anne Wirsching\r\nStory status',
				'MOSSlugs' : 'NYHETSSAK 1;SAK-14\r\nBYVEKST AVTALE;BYVEKST-AVTALE-300818-SL-31\r\nSAK 1;BYVEKST-AVTALE-300818-SL-35\r\n01 navn|Ett navn (00:34=>00:05, Auto/Auto): Mette Gundersen, gruppeleder, Arbeiderpartiet, Kristiansand\r\n01 navn|Ett navn (00:18=>00:05, Auto/Auto): Harald Furre, ordfører Kristiansand (H)\r\n24 Foto/Redigering (01:43=>00:05, Auto/Auto): Foto/redigering:, Anne Wirsching\r\nNYHETSSAK 1;SAK-16',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'TextTime' : 0,
				'AndreMetadata' : '{reporter};Anne Wirsching;+{Redigerer};Anne Wirsching;',
				'Bildebeskrivelse' : 'Biltrafikk, bomstasjon (arkiv). Professor ved skrivepulten sin FRA RUBRIKKTEKST:',
				'Fylke' : 'Vest-Agder',
				'Innslagstittel' : 'Strid om bompengepakke i Kristiansand',
				'Kommune' : 'Kristiansand',
				'mosartType' : 'FULL',
				'OpprLand' : 'Norge',
				'ReadTime' : 108.56,
				'Rettigheter' : 'Grønt',
				'Rettighetseier' : 'NRK',
				'Sted' : 'Kristiansand',
				'Tags' : 'bompenger; bompengepakke; bomstasjoner',
				'Team' : '{reporter};Anne Wirsching;+{Redigerer};Anne Wirsching;',
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'ID' : '2',
				'ObjectID' : 'N12050_1536226262',
				'MOSID' : 'METADATA.NRK.MOS',
				'Slug' : 'NYHETSSAK 1;SAK-14',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://mosA4.com/mos/supported_schemas/MOSAXML2.08',
						'MosPayload' : {
							'nrk' : {
								'attributes' : {
									'changetime' : '2018-09-06T11:31:02 +02:00',
									'changedBy' : 'N12050',
									'type' : 'video',
									'mdSource' : 'omnibus'
								},
								'title' : 'Strid om bompengepakke i Kristiansand',
								'description' : 'Biltrafikk, bomstasjon (arkiv). Professor ved skrivepulten sin FRA RUBRIKKTEKST:',
								'hbbtv' : {
									'link' : '',
									'@name' : 'hbbtv',
									'@type' : 'element'
								},
								'staff' : {
									'text' : 'Anne Wirsching',
									'userid' : 'n15348',
									'roles' : 'reporter;Redigerer',
									'@name' : 'staff',
									'@type' : 'text'
								},
								'location' : {
									'text' : 'Kristiansand',
									'id' : '1-2376',
									'region' : 'Vest-Agder',
									'lat' : '58.14615',
									'lon' : '7.99573',
									'@name' : 'location',
									'@type' : 'text'
								},
								'tag' : [
									{
										'text' : 'bompenger',
										'id' : '631',
										'@name' : 'tag',
										'@type' : 'text'
									},
									{
										'text' : 'bompengepakke',
										'id' : '103045',
										'@name' : 'tag',
										'@type' : 'text'
									},
									{
										'text' : 'bomstasjoner',
										'id' : '19461',
										'@name' : 'tag',
										'@type' : 'text'
									}
								],
								'rights' : {
									'text' : 'Green',
									'notes' : '',
									'owner' : 'NRK',
									'@name' : 'rights',
									'@type' : 'text'
								}
							}
						}
					}
				],
				'mosAbstract' : 'M: Strid om bompengepakke i Kristiansand (06-09-18 11:31)',
				'ObjectSlug' : 'M: Strid om bompengepakke i Kristiansand'
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
				'ID' : '31',
				'ObjectID' : '\\\\NDSL\\Omn\\D\\C\\06\\59',
				'MOSID' : 'OMNIBUS.NDSL.MOS',
				'Slug' : 'BYVEKST AVTALE;BYVEKST-AVTALE-300818-SL-31',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'OMNIBUS',
						'MosPayload' : {
							'title' : 'Strid om bompengepakke i Kristiansand',
							'objectType' : 'CLIP',
							'clipType' : 'NYHETER',
							'objDur' : 5428
						}
					}
				],
				'mosAbstract' : 'BYVEKST-AVTALE-300818-SL NYHETER 00:01:48:14',
				'ObjectSlug' : 'BYVEKST-AVTALE-300818-SL',
				'Duration' : 5428,
				'TimeBase' : 50
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
				'ID' : '35',
				'ObjectID' : '814568b8-e831-4067-894f-43bf4349b082',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'SAK 1;BYVEKST-AVTALE-300818-SL-35',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'e97d2fc2-e887-4858-925b-a10923943137',
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
									'time' : '(00:02=>00:05, Auto/Auto)',
									'templateName' : '01 navn',
									'templateVariant' : 'Ett navn',
									'content' : 'Anne Wirsching, reporter',
									'full' : '01 navn|Ett navn (00:02=>00:05, Auto/Auto): Anne Wirsching, reporter'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T10:54:49',
									'changed' : '2018-09-06-T10:54:49'
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
								'navn' : 'Anne Wirsching',
								'tittel' : 'reporter'
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'timeIn' : 2000,
							'duration' : 5000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '01 navn|Ett navn (00:02=>00:05, Auto/Auto): Anne Wirsching, reporter'
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
				'ID' : '33',
				'ObjectID' : '3ef6eaf7-61fe-4d23-82ee-92814d98070a',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '673e56f4-386e-41dc-83b9-93cafc1a647c',
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
									'time' : '(00:34=>00:05, Auto/Auto)',
									'templateName' : '01 navn',
									'templateVariant' : 'Ett navn',
									'content' : 'Mette Gundersen, gruppeleder, Arbeiderpartiet, Kristiansand',
									'full' : '01 navn|Ett navn (00:34=>00:05, Auto/Auto): Mette Gundersen, gruppeleder, Arbeiderpartiet, Kristiansand'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T11:29:50',
									'changed' : '2018-09-06-T11:29:50'
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
								'navn' : 'Mette Gundersen',
								'tittel' : 'gruppeleder, Arbeiderpartiet, Kristiansand'
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'timeIn' : 34000,
							'duration' : 5000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '01 navn|Ett navn (00:34=>00:05, Auto/Auto): Mette Gundersen, gruppeleder, Arbeiderpartiet, Kristiansand'
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
				'ID' : '36',
				'ObjectID' : '02f3fcd7-11cc-4ed3-b46b-2dbf9b41700f',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '5a49c52e-741a-449f-b219-1546966aee9c',
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
									'time' : '(00:18=>00:05, Auto/Auto)',
									'templateName' : '01 navn',
									'templateVariant' : 'Ett navn',
									'content' : 'Harald Furre, ordfører Kristiansand (H)',
									'full' : '01 navn|Ett navn (00:18=>00:05, Auto/Auto): Harald Furre, ordfører Kristiansand (H)'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T11:30:27',
									'changed' : '2018-09-06-T11:30:27'
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
								'navn' : 'Harald Furre',
								'tittel' : 'ordfører Kristiansand (H)'
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'timeIn' : 18000,
							'duration' : 5000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '01 navn|Ett navn (00:18=>00:05, Auto/Auto): Harald Furre, ordfører Kristiansand (H)'
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
				'ID' : '34',
				'ObjectID' : '36084b03-2bfd-4f48-b08e-f30c8bb7a891',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'd706fca8-8454-49d7-ac48-41d988053d19',
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
										'displayName' : '24 Foto/Redigering',
										'path' : '24_foto_red'
									}
								},
								'name' : {
									'time' : '(01:43=>00:05, Auto/Auto)',
									'templateName' : '24 Foto/Redigering',
									'templateVariant' : '',
									'content' : 'Foto/redigering:, Anne Wirsching',
									'full' : '24 Foto/Redigering (01:43=>00:05, Auto/Auto): Foto/redigering:, Anne Wirsching'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T11:30:50',
									'changed' : '2018-09-06-T11:30:50'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '24_foto_red',
								'layer' : 'super'
							},
							'content' : {
								'_valid' : true,
								'funksjon' : 'Foto/redigering:',
								'navn' : 'Anne Wirsching',
								'funksjon2' : '',
								'navn2' : ''
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'timeIn' : 103000,
							'duration' : 5000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '24 Foto/Redigering (01:43=>00:05, Auto/Auto): Foto/redigering:, Anne Wirsching'
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
				'ID' : '9',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'NYHETSSAK 1;SAK-16',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;28C8BD26-1616-4E04-A6B9442280AF352A',
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
				'mosartVariant' : 1,
				'ReadTime' : 0,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;0E405892-E8E0-418A-A57DA3FE0A48FE45',
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
				'mosartVariant' : 3,
				'ReadTime' : 0,
				'Rettigheter' : 'Grønt',
				'Rettighetseier' : 'NRK',
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
},{

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;66753E53-519A-4ADF-B353F955B396BC77',
	'Slug' : 'SYKKEL VEI;intro -',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 10,
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101954Z',
				'MOSItemDurations' : 0,
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : '202 Bilde (Manual/OnNext): Sykkelvei Hannevika\r\n202 Bilde (Manual/OnNext): Utsikt fra værradaren i Hæg...\r\nKAVALKADE-310818S-SL\r\nStory status',
				'MOSSlugs' : 'SYKKEL VEI;intro --7\r\nSYKKEL VEI;intro --8\r\nSYKKEL VEI;intro --2\r\nNYHETSSAK 1;Studio med baksjkerm-7',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'StoryLogPreview' : 'Det har kostet 87 millioner kroner å lage en sykkelvei på drøyt en kilometer, i Kristiansand.',
				'TextTime' : 13,
				'mosartType' : 'KAM',
				'mosartVariant' : 2,
				'ReadTime' : 13,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'text' : 'Det har kostet 87 millioner kroner å lage en sykkelvei på drøyt en kilometer, i Kristiansand.',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : 'Men målet er at denne veistubben skal få flere til å velge bort bilen og ta sykkelen fatt.',
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
				'ID' : '7',
				'ObjectID' : 'd0507570-f8a1-41a8-9edf-75b676008fe9',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'SYKKEL VEI;intro --7',
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
									'content' : 'Sykkelvei Hannevika',
									'full' : '202 Bilde (Manual/OnNext): Sykkelvei Hannevika'
								},
								'type' : 'bakskjerm',
								'userContext' : {
									'text' : '2018-09-06-T11:34:28',
									'changed' : '2018-09-06-T11:34:28'
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
									'creators' : 'Thomas Sommerset',
									'credit' : '',
									'title' : 'Sykkelvei Hannevika',
									'w' : 1,
									'format' : 'image/jpeg',
									'width' : 1920,
									'text' : 0,
									'x' : 0,
									'h' : 1,
									'y' : 0,
									'id' : 'c1jqlCnJ42gBhj1ZmU07LQ',
									'type' : 'image/jpeg',
									'uri' : 'c1jqlCnJ42gBhj1ZmU07LQA0gFUloGcRbikfNNNr_CKA',
									'quality' : 0.9,
									'height' : 1080,
									'url' : 'https://gfx.nrk.no/c1jqlCnJ42gBhj1ZmU07LQA0gFUloGcRbikfNNNr_CKA'
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
				'mosAbstract' : '202 Bilde (Manual/OnNext): Sykkelvei Hannevika'
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
				'text' : '<BAK><',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '8',
				'ObjectID' : 'a59adcf9-0d51-4c73-b21c-febb3e271f20',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'SYKKEL VEI;intro --8',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '4f4577ef-c594-4cab-adaf-4ab69226d616',
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
									'content' : 'Utsikt fra værradaren i Hæg...',
									'full' : '202 Bilde (Manual/OnNext): Utsikt fra værradaren i Hæg...'
								},
								'type' : 'bakskjerm',
								'userContext' : {
									'text' : '2018-09-06-T12:19:01',
									'changed' : '2018-09-06-T12:19:01'
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
									'creators' : 'Kai Stokkeland',
									'credit' : '',
									'title' : 'Utsikt fra værradaren i Hæg...',
									'w' : 1,
									'format' : 'image/jpeg',
									'width' : 1920,
									'text' : 0,
									'x' : 0,
									'h' : 1,
									'y' : 0,
									'id' : 'bHo_Iek9yJIx8_sAqwT7vg',
									'type' : 'image/jpeg',
									'uri' : 'bHo_Iek9yJIx8_sAqwT7vgTctUWKdqrLZNC34NqX8vDg',
									'quality' : 0.9,
									'height' : 1080,
									'url' : 'https://gfx.nrk.no/bHo_Iek9yJIx8_sAqwT7vgTctUWKdqrLZNC34NqX8vDg'
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
				'mosAbstract' : '202 Bilde (Manual/OnNext): Utsikt fra værradaren i Hæg...'
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
				'text' : '<BAK><RM1>',
				'@name' : 'p',
				'@type' : 'text'
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
				'ID' : '2',
				'ObjectID' : '\\\\NDSL\\Omn\\D\\C\\08\\33',
				'MOSID' : 'OMNIBUS.NDSL.MOS',
				'Slug' : 'SYKKEL VEI;intro --2',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'OMNIBUS',
						'MosPayload' : {
							'title' : 'kavalkade',
							'objectType' : 'CLIP',
							'clipType' : 'NYHETER_STK',
							'text' : 0,
							'objDur' : 0,
							'objType' : 'VIDEO'
						}
					}
				],
				'mosAbstract' : 'KAVALKADE-310818S-SL NYHETER_STK 00:00:00:00',
				'ObjectSlug' : 'KAVALKADE-310818S-SL',
				'Duration' : 0,
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
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '3',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;502BA2D7-79B1-491D-80DF5FE6C67908E8',
	'Slug' : 'SYKKEL VEI;SYKKEL-VEI-310818-SL',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'MediaTime' : 110.92,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101613Z',
				'MOSItemDurations' : '110,92',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'M: \r\nSYKKELVEI-II-310818-SL\r\n01 navn|Ett navn (00:04=>00:05, Auto/Auto): Hans Erik Weiby, reporter\r\n01 navn|Ett navn (00:13=>00:05, Auto/Auto): Kirsten Falch\r\n01 navn|Ett navn (00:21=>00:05, Auto/Auto): Eva Høiby\r\n01 navn|Ett navn (00:53=>00:05, Auto/Auto): Jørgen Haugland Kristiansen, varaordfører, Kristiansand (Krf)\r\n01 navn|Ett navn (01:17=>00:05, Auto/Auto): Dagfinn Fløystad, avdelingsdirektør, Statens Vegvesen\r\n24 Foto/Redigering (01:39=>00:05, Auto/Auto): Foto/redigering:, Hans Erik Weiby\r\nStory status',
				'MOSSlugs' : 'NYHETSSAK 1;SAK-14\r\nSYKKEL VEI;SYKKEL-VEI-310818-SL-39\r\n01 navn|Ett navn (00:04=>00:05, Auto/Auto): Hans Erik Weiby, reporter\r\nSAK 2;SYKKEL-VEI-310818-SL-40\r\nSAK 2;SYKKEL-VEI-310818-SL-41\r\nSAK 2;SYKKEL-VEI-310818-SL-42\r\nSAK 2;SYKKEL-VEI-310818-SL-43\r\n24 Foto/Redigering (01:39=>00:05, Auto/Auto): Foto/redigering:, Hans Erik Weiby\r\nNYHETSSAK 1;SAK-16',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'TextTime' : 0,
				'mosartType' : 'FULL',
				'ReadTime' : 110.92,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'ID' : '2',
				'ObjectID' : 'ENPSADM_1398418232',
				'MOSID' : 'METADATA.NRK.MOS',
				'Slug' : 'NYHETSSAK 1;SAK-14',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://mosA4.com/mos/supported_schemas/MOSAXML2.08',
						'MosPayload' : {
							'nrk' : {
								'attributes' : {
									'type' : 'video',
									'changedBy' : 'ENPSADM',
									'changetime' : '2014-04-25T11:30:32 +02:00'
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
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '35',
				'ObjectID' : '\\\\NDSL\\Omn\\D\\C\\08\\36',
				'MOSID' : 'OMNIBUS.NDSL.MOS',
				'Slug' : 'SYKKEL VEI;SYKKEL-VEI-310818-SL-39',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'OMNIBUS',
						'MosPayload' : {
							'title' : 'sykkelvei-II',
							'objectType' : 'CLIP',
							'clipType' : 'NYHETER',
							'objDur' : 5546,
							'objType' : 'VIDEO'
						}
					}
				],
				'mosAbstract' : 'SYKKELVEI-II-310818-SL NYHETER 00:01:50:23',
				'ObjectSlug' : 'SYKKELVEI-II-310818-SL',
				'Duration' : 5546,
				'TimeBase' : 50
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
				'ID' : '33',
				'ObjectID' : '29b268ad-ae53-4abb-bb3a-2b572f9ecb89',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'e97d2fc2-e887-4858-925b-a10923943137',
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
									'time' : '(00:04=>00:05, Auto/Auto)',
									'templateName' : '01 navn',
									'templateVariant' : 'Ett navn',
									'content' : 'Hans Erik Weiby, reporter',
									'full' : '01 navn|Ett navn (00:04=>00:05, Auto/Auto): Hans Erik Weiby, reporter'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T11:36:10',
									'changed' : '2018-09-06-T11:36:10'
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
								'navn' : 'Hans Erik Weiby',
								'tittel' : 'reporter'
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'timeIn' : 4000,
							'duration' : 5000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '01 navn|Ett navn (00:04=>00:05, Auto/Auto): Hans Erik Weiby, reporter'
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
				'ID' : '40',
				'ObjectID' : '63619b73-6753-489a-bba2-6cf8f0a32b09',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'SAK 2;SYKKEL-VEI-310818-SL-40',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'e97d2fc2-e887-4858-925b-a10923943137',
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
									'time' : '(00:13=>00:05, Auto/Auto)',
									'templateName' : '01 navn',
									'templateVariant' : 'Ett navn',
									'content' : 'Kirsten Falch',
									'full' : '01 navn|Ett navn (00:13=>00:05, Auto/Auto): Kirsten Falch'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T11:53:41',
									'changed' : '2018-09-06-T11:53:41'
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
								'navn' : 'Kirsten Falch',
								'tittel' : ''
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'timeIn' : 13000,
							'duration' : 5000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '01 navn|Ett navn (00:13=>00:05, Auto/Auto): Kirsten Falch'
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
				'ID' : '41',
				'ObjectID' : 'e79b21ba-c3f7-48a5-a4f6-ff9f3cbed633',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'SAK 2;SYKKEL-VEI-310818-SL-41',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'e97d2fc2-e887-4858-925b-a10923943137',
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
									'time' : '(00:21=>00:05, Auto/Auto)',
									'templateName' : '01 navn',
									'templateVariant' : 'Ett navn',
									'content' : 'Eva Høiby',
									'full' : '01 navn|Ett navn (00:21=>00:05, Auto/Auto): Eva Høiby'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T11:54:04',
									'changed' : '2018-09-06-T11:54:04'
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
								'navn' : 'Eva Høiby',
								'tittel' : ''
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'timeIn' : 21000,
							'duration' : 5000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '01 navn|Ett navn (00:21=>00:05, Auto/Auto): Eva Høiby'
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
				'ID' : '42',
				'ObjectID' : 'c8d9c5cf-91a4-46a0-8ce0-a7d15d8eff86',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'SAK 2;SYKKEL-VEI-310818-SL-42',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'e97d2fc2-e887-4858-925b-a10923943137',
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
									'time' : '(00:53=>00:05, Auto/Auto)',
									'templateName' : '01 navn',
									'templateVariant' : 'Ett navn',
									'content' : 'Jørgen Haugland Kristiansen, varaordfører, Kristiansand (Krf)',
									'full' : '01 navn|Ett navn (00:53=>00:05, Auto/Auto): Jørgen Haugland Kristiansen, varaordfører, Kristiansand (Krf)'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T11:54:46',
									'changed' : '2018-09-06-T11:54:46'
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
								'navn' : 'Jørgen Haugland Kristiansen',
								'tittel' : 'varaordfører, Kristiansand (Krf)'
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'timeIn' : 53000,
							'duration' : 5000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '01 navn|Ett navn (00:53=>00:05, Auto/Auto): Jørgen Haugland Kristiansen, varaordfører, Kristiansand (Krf)'
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
				'ID' : '43',
				'ObjectID' : '81ea3c8c-aed4-406d-b9a4-b777ba25e94d',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'SAK 2;SYKKEL-VEI-310818-SL-43',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'e97d2fc2-e887-4858-925b-a10923943137',
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
									'time' : '(01:17=>00:05, Auto/Auto)',
									'templateName' : '01 navn',
									'templateVariant' : 'Ett navn',
									'content' : 'Dagfinn Fløystad, avdelingsdirektør, Statens Vegvesen',
									'full' : '01 navn|Ett navn (01:17=>00:05, Auto/Auto): Dagfinn Fløystad, avdelingsdirektør, Statens Vegvesen'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T11:55:24',
									'changed' : '2018-09-06-T11:55:24'
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
								'navn' : 'Dagfinn Fløystad',
								'tittel' : 'avdelingsdirektør, Statens Vegvesen'
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'timeIn' : 77000,
							'duration' : 5000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '01 navn|Ett navn (01:17=>00:05, Auto/Auto): Dagfinn Fløystad, avdelingsdirektør, Statens Vegvesen'
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
				'ID' : '34',
				'ObjectID' : '54a4a3e8-ac42-49d5-ba92-b8c55e88f2fb',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'd706fca8-8454-49d7-ac48-41d988053d19',
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
										'displayName' : '24 Foto/Redigering',
										'path' : '24_foto_red'
									}
								},
								'name' : {
									'time' : '(01:39=>00:05, Auto/Auto)',
									'templateName' : '24 Foto/Redigering',
									'templateVariant' : '',
									'content' : 'Foto/redigering:, Hans Erik Weiby',
									'full' : '24 Foto/Redigering (01:39=>00:05, Auto/Auto): Foto/redigering:, Hans Erik Weiby'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T11:56:04',
									'changed' : '2018-09-06-T11:56:04'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '24_foto_red',
								'layer' : 'super'
							},
							'content' : {
								'_valid' : true,
								'funksjon' : 'Foto/redigering:',
								'navn' : 'Hans Erik Weiby',
								'funksjon2' : '',
								'navn2' : ''
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'timeIn' : 99000,
							'duration' : 5000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '24 Foto/Redigering (01:39=>00:05, Auto/Auto): Foto/redigering:, Hans Erik Weiby'
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
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '9',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'NYHETSSAK 1;SAK-16',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;AA5E11E3-3005-4C20-A90835F8C79BD091',
	'Slug' : 'PADLERE;Kamera - ikke skriv her',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 3,
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101613Z',
				'MOSObjSlugs' : 'Story status',
				'MOSSlugs' : 'STK SYNK;INTRO-3',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'TextTime' : 0,
				'mosartType' : 'KAM',
				'mosartVariant' : 1,
				'ReadTime' : 0,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'text' : '[Merknad:Ikke slriv her]',
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
				'ID' : '2',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'STK SYNK;INTRO-3',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;092CD96C-7080-414F-AA33B6942F5CC07E',
	'Slug' : 'PADLERE;PADLERE-300818S-SL',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 15,
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101613Z',
				'MOSItemDurations' : '23,6',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'M: \r\nPADLERE-300818S-SL\r\n22 Sted/Arkiv (00:00=>00:05, Auto/Auto)\r\n10 Tema|Vanlig (00:00, Auto/OnNext): Har seilt hele Norskekysten\r\nStory status',
				'MOSSlugs' : 'STK SYNK 1;STK-10\r\nPADLERE;PADLERE-300818S-SL-2\r\nSTK-SYNK 1;STK-15\r\n10 Tema|Vanlig (00:00, Auto/OnNext): Har seilt hele Norskekysten\r\nSTK SYNK 1;STK-12',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'StoryLogPreview' : 'Elin Ellingsvik Vegestøl fra Sundebru /S/  i Aust-Agder har seilt hele norskekysten fra Nordkapp til Østfold, sammen med makker Stehn Ihlebakke. De to kom frem denne uken etter å ha seilt i fire måneder og ble tatt imot av familie og venner. De to er de første som har seilt Norges kyst på langs med kajakk.',
				'TextTime' : 21,
				'mosartType' : 'STK',
				'ReadTime' : 21,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'ID' : '5',
				'ObjectID' : 'ENPSADM_1398418232',
				'MOSID' : 'METADATA.NRK.MOS',
				'Slug' : 'STK SYNK 1;STK-10',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://mosA4.com/mos/supported_schemas/MOSAXML2.08',
						'MosPayload' : {
							'nrk' : {
								'attributes' : {
									'type' : 'video',
									'changedBy' : 'ENPSADM',
									'changetime' : '2014-04-25T11:30:32 +02:00'
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
				'text' : 'Elin Ellingsvik Vegestøl fra Sundebru /S/ i Aust-Agder har seilt hele norskekysten fra Nordkapp til Østfold, sammen med makker Stehn Ihlebakke. De to kom frem denne uken etter å ha seilt i fire måneder og ble tatt imot av familie og venner. De to er de første som har seilt Norges kyst på langs med kajakk.',
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
				'text' : '<',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '2',
				'ObjectID' : '\\\\NDSL\\Omn\\D\\C\\06\\71',
				'MOSID' : 'OMNIBUS.NDSL.MOS',
				'Slug' : 'PADLERE;PADLERE-300818S-SL-2',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'OMNIBUS',
						'MosPayload' : {
							'title' : 'Har seilt hele norskekysten',
							'objectType' : 'CLIP',
							'clipType' : 'NYHETER_STK',
							'objDur' : 1180
						}
					}
				],
				'mosAbstract' : 'PADLERE-300818S-SL NYHETER_STK 00:00:23:15',
				'ObjectSlug' : 'PADLERE-300818S-SL',
				'Duration' : 1180,
				'TimeBase' : 50
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : 'legg klippet her >',
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
				'ID' : '15',
				'ObjectID' : '4b81b5ca-30a7-4402-b1a8-b8b2e8802538',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'STK-SYNK 1;STK-15',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '5884aa1c-3738-44e7-81d9-5f0d2b761c1c',
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
										'displayName' : '22 Sted/Arkiv',
										'path' : '22_sted_arkiv'
									}
								},
								'name' : {
									'time' : '(00:00=>00:05, Auto/Auto)',
									'templateName' : '22 Sted/Arkiv',
									'templateVariant' : '',
									'content' : '',
									'full' : '22 Sted/Arkiv (00:00=>00:05, Auto/Auto)'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-08-30-T17:17:32',
									'changed' : '2018-08-30-T17:17:32'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '22_sted_arkiv',
								'layer' : 'tagLeft'
							},
							'content' : {
								'_valid' : true
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
							'in' : 'auto',
							'out' : 'manual'
						}
					}
				],
				'mosAbstract' : '22 Sted/Arkiv (00:00=>00:05, Auto/Auto)'
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
				'ID' : '16',
				'ObjectID' : 'bd3a3443-0d6c-43e8-b14d-02034fd7473a',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'e019ade3-3b0c-4ca7-8703-8a684717f59b',
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
										'displayName' : '10 Tema: Vanlig',
										'path' : '10_tema'
									}
								},
								'name' : {
									'time' : '(00:00, Auto/OnNext)',
									'templateName' : '10 Tema',
									'templateVariant' : 'Vanlig',
									'content' : 'Har seilt hele Norskekysten',
									'full' : '10 Tema|Vanlig (00:00, Auto/OnNext): Har seilt hele Norskekysten'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T12:03:43',
									'changed' : '2018-09-06-T12:03:43'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '10_tema',
								'layer' : 'tema'
							},
							'content' : {
								'_valid' : true,
								'tagtekst' : '#nrknyheter',
								'tematekst' : 'Har seilt hele Norskekysten',
								'infotekst' : ''
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
							'in' : 'auto',
							'out' : 'onNext'
						}
					}
				],
				'mosAbstract' : '10 Tema|Vanlig (00:00, Auto/OnNext): Har seilt hele Norskekysten'
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
				'ID' : '9',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'STK SYNK 1;STK-12',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;7EE5EE3E-8DB5-453E-97CA8C4F64952B6B',
	'Slug' : 'PADLERE;PADLERE-300818F-SL',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 20,
				'MediaTime' : 9.24,
				'ModBy' : 'OMNIBUS.NDSL.MOS',
				'ModTime' : '20180906T103339Z',
				'MOSItemDurations' : '9,24',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'M: \r\nPADLERE-300818F-SL\r\n01 navn|Ett navn (00:02=>00:05, Auto/Auto): Elin Ellingsvik Vegestøl\r\nStory status',
				'MOSSlugs' : 'STK SYNK;STK SYNK-2\r\nPADLERE;PADLERE-300818F-SL-10\r\n01 navn|Ett navn (00:02=>00:05, Auto/Auto): Elin Ellingsvik Vegestøl\r\nSTK SYNK;STK SYNK-4',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'TextTime' : 0,
				'mosartType' : 'FULL',
				'ReadTime' : 9.24,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'ID' : '2',
				'ObjectID' : 'ENPSADM_1398418232',
				'MOSID' : 'METADATA.NRK.MOS',
				'Slug' : 'STK SYNK;STK SYNK-2',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://mosA4.com/mos/supported_schemas/MOSAXML2.08',
						'MosPayload' : {
							'nrk' : {
								'attributes' : {
									'type' : 'video',
									'changedBy' : 'ENPSADM',
									'changetime' : '2014-04-25T11:30:32 +02:00'
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
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '10',
				'ObjectID' : '\\\\NDSL\\Omn\\D\\C\\06\\72',
				'MOSID' : 'OMNIBUS.NDSL.MOS',
				'Slug' : 'PADLERE;PADLERE-300818F-SL-10',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'OMNIBUS',
						'MosPayload' : {
							'title' : 'PADLERE-300818F-SL',
							'objectType' : 'CLIP',
							'clipType' : 'NYHETER',
							'objDur' : 462
						}
					}
				],
				'mosAbstract' : 'PADLERE-300818F-SL NYHETER 00:00:09:06',
				'ObjectSlug' : 'PADLERE-300818F-SL',
				'Duration' : 462,
				'TimeBase' : 50
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
				'ID' : '11',
				'ObjectID' : 'aa10a9fc-4997-4e67-92a8-93dfa1c84d36',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '54e5cc2d-06cd-4dd7-9a7d-bb1cf6f920ce',
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
									'time' : '(00:02=>00:05, Auto/Auto)',
									'templateName' : '01 navn',
									'templateVariant' : 'Ett navn',
									'content' : 'Elin Ellingsvik Vegestøl',
									'full' : '01 navn|Ett navn (00:02=>00:05, Auto/Auto): Elin Ellingsvik Vegestøl'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T12:04:43',
									'changed' : '2018-09-06-T12:04:43'
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
								'navn' : 'Elin Ellingsvik Vegestøl',
								'tittel' : ''
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'timeIn' : 2000,
							'duration' : 5000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '01 navn|Ett navn (00:02=>00:05, Auto/Auto): Elin Ellingsvik Vegestøl'
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
				'ID' : '4',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'STK SYNK;STK SYNK-4',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;86F1CD05-E04A-48B4-A93C2DCCFBDD8B8F',
	'Slug' : 'DIREKTE PUNKT FESTIVAL;intro -',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 1,
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101613Z',
				'MOSObjSlugs' : 'Story status',
				'MOSSlugs' : 'NYHETSSAK 1;Studio med baksjkerm-7',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'StoryLogPreview' : 'I dag åpner Punkt festivalen i Kristiansand, for fjortende gang. \r\nI tre dager skal publikum underholdes av artister fra inn- og utland.',
				'TextTime' : 9,
				'mosartType' : 'KAM',
				'mosartVariant' : 1,
				'ReadTime' : 9,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
	'Body' : [
		{
			'Type' : 'p',
			'Content' : {
				'text' : 'I dag åpner Punkt festivalen i Kristiansand, for fjortende gang.',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : 'I tre dager skal publikum underholdes av artister fra inn- og utland.',
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
				'ID' : '6',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;408A738B-30C6-4528-BB1E30F31BF12AB6',
	'Slug' : 'DIREKTE PUNKT FESTIVAL;PUNKTFESTIVALE-300818S-SL',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'Actual' : 10,
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'MediaTime' : 0,
				'ModBy' : 'OMNIBUS.NDSL.MOS',
				'ModTime' : '20180906T103414Z',
				'MOSItemDurations' : '27,28',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'M: \r\nPUNKTFESTIVALE-300818S-SL\r\n22 Sted/Arkiv (00:00=>00:05, Auto/Auto): Kristiansand\r\n10 Tema|Vanlig (00:00, Auto/OnNext)\r\nStory status',
				'MOSSlugs' : 'STK SYNK 1;STK-10\r\nDIREKTE PUNKT FESTIVAL;PUNKTFESTIVALE-300818S-SL-2\r\n22 Sted/Arkiv (00:00=>00:05, Auto/Auto): Kristiansand\r\nKOMMER 2055;STK-20\r\nSTK SYNK 1;STK-12',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'StoryLogPreview' : '< legg klippet her >',
				'TextTime' : 0,
				'mosartType' : 'STK',
				'ReadTime' : 0,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'ID' : '5',
				'ObjectID' : 'ENPSADM_1398418232',
				'MOSID' : 'METADATA.NRK.MOS',
				'Slug' : 'STK SYNK 1;STK-10',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://mosA4.com/mos/supported_schemas/MOSAXML2.08',
						'MosPayload' : {
							'nrk' : {
								'attributes' : {
									'type' : 'video',
									'changedBy' : 'ENPSADM',
									'changetime' : '2014-04-25T11:30:32 +02:00'
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
				'text' : '<',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '2',
				'ObjectID' : '\\\\NDSL\\Omn\\D\\C\\06\\68',
				'MOSID' : 'OMNIBUS.NDSL.MOS',
				'Slug' : 'DIREKTE PUNKT FESTIVAL;PUNKTFESTIVALE-300818S-SL-2',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'OMNIBUS',
						'MosPayload' : {
							'title' : 'PUNKTFESTIVALE-300818S-SL',
							'objectType' : 'CLIP',
							'clipType' : 'NYHETER_STK',
							'objDur' : 1364
						}
					}
				],
				'mosAbstract' : 'PUNKTFESTIVALE-300818S-SL NYHETER_STK 00:00:27:07',
				'ObjectSlug' : 'PUNKTFESTIVALE-300818S-SL',
				'Duration' : 1364,
				'TimeBase' : 50
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : 'legg klippet her >',
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
				'ID' : '13',
				'ObjectID' : '82d3d628-6564-4c3d-b29a-abad82d7bb81',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '060d650f-ef56-45f8-b9a5-8891c137bdf5',
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
										'displayName' : '22 Sted/Arkiv',
										'path' : '22_sted_arkiv'
									}
								},
								'name' : {
									'time' : '(00:00=>00:05, Auto/Auto)',
									'templateName' : '22 Sted/Arkiv',
									'templateVariant' : '',
									'content' : 'Kristiansand',
									'full' : '22 Sted/Arkiv (00:00=>00:05, Auto/Auto): Kristiansand'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T12:06:45',
									'changed' : '2018-09-06-T12:06:45'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '22_sted_arkiv',
								'layer' : 'tagLeft'
							},
							'content' : {
								'_valid' : true,
								'sted' : 'Kristiansand',
								'arkiv' : ''
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
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '22 Sted/Arkiv (00:00=>00:05, Auto/Auto): Kristiansand'
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
				'ID' : '14',
				'ObjectID' : '95bce67a-bd0a-4597-8353-51d85d6cf616',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'KOMMER 2055;STK-20',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '21b7a51a-c3c6-4325-9ea5-46e7128049d2',
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
										'displayName' : '10 Tema: Vanlig',
										'path' : '10_tema'
									}
								},
								'name' : {
									'time' : '(00:00, Auto/OnNext)',
									'templateName' : '10 Tema',
									'templateVariant' : 'Vanlig',
									'content' : '',
									'full' : '10 Tema|Vanlig (00:00, Auto/OnNext)'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-08-30-T17:21:29',
									'changed' : '2018-08-30-T17:21:29'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '10_tema',
								'layer' : 'tema'
							},
							'content' : {
								'_valid' : true,
								'tagtekst' : '#nrknyheter',
								'tematekst' : '',
								'infotekst' : ''
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
							'in' : 'auto',
							'out' : 'onNext'
						}
					}
				],
				'mosAbstract' : '10 Tema|Vanlig (00:00, Auto/OnNext)'
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
				'ID' : '9',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'STK SYNK 1;STK-12',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;CF823026-A06F-4676-B0809CAD9779E178',
	'Slug' : 'DIREKTE PUNKT FESTIVAL;Split',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101612Z',
				'MOSItemDurations' : '',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : '10 Tema|Vanlig (00:00, Auto/OnNext)\r\n55 Direkte (00:00, Auto/OnNext): Kristiansand\r\nStory status',
				'MOSSlugs' : 'DIREKTE 1850;Split-10\r\n55 Direkte (00:00, Auto/OnNext): Kristiansand\r\nLIVE;spørsmål i split-11',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'StoryLogPreview' : 'Og, kollega Janne Åteigen hva er spesielt med Punkt festivalen?',
				'TextTime' : 4,
				'ip1' : 'K1',
				'ip2' : 'RM1',
				'mosartType' : 'DVE',
				'mosartVariant' : '2LIKE',
				'ReadTime' : 4,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
	'Body' : [
		{
			'Type' : 'p',
			'Content' : {
				'text' : 'Og, kollega Janne Åteigen hva er spesielt med Punkt festivalen?',
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
				'ID' : '10',
				'ObjectID' : '9c9c93dd-7f3e-4394-b669-056d6b54d17f',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'DIREKTE 1850;Split-10',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '9eafea99-1ed2-4456-aebb-e1b1edc462fa',
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
										'displayName' : '10 Tema: Vanlig',
										'path' : '10_tema'
									}
								},
								'name' : {
									'time' : '(00:00, Auto/OnNext)',
									'templateName' : '10 Tema',
									'templateVariant' : 'Vanlig',
									'content' : '',
									'full' : '10 Tema|Vanlig (00:00, Auto/OnNext)'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-04-T13:48:49',
									'changed' : '2018-09-04-T13:48:49'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '10_tema',
								'layer' : 'tema'
							},
							'content' : {
								'_valid' : true,
								'tagtekst' : '#nrknyheter',
								'tematekst' : '',
								'infotekst' : ''
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
							'in' : 'auto',
							'out' : 'onNext'
						}
					}
				],
				'mosAbstract' : '10 Tema|Vanlig (00:00, Auto/OnNext)'
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
				'ID' : '9',
				'ObjectID' : '8b360469-d524-4a8e-8136-4e6830cb401c',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '5ec85532-9f57-4246-88fd-74e97f2ee5e5',
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
										'displayName' : '55 Direkte',
										'path' : '55_direkte'
									}
								},
								'name' : {
									'time' : '(00:00, Auto/OnNext)',
									'templateName' : '55 Direkte',
									'templateVariant' : '',
									'content' : 'Kristiansand',
									'full' : '55 Direkte (00:00, Auto/OnNext): Kristiansand'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T12:07:44',
									'changed' : '2018-09-06-T12:07:44'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '55_direkte',
								'layer' : 'tagRight'
							},
							'content' : {
								'_valid' : true,
								'text' : 'Kristiansand',
								'sted' : 'Kristiansand'
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
							'in' : 'auto',
							'out' : 'onNext'
						}
					}
				],
				'mosAbstract' : '55 Direkte (00:00, Auto/OnNext): Kristiansand'
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
				'ID' : '4',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'LIVE;spørsmål i split-11',
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
		}
	]
},{

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;3BD75620-FA60-45E7-88C48E154209C90E',
	'Slug' : 'DIREKTE PUNKT FESTIVAL;Live',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101612Z',
				'MOSItemDurations' : '',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'M: \r\n01 navn|Ett navn (00:05, Manual/Auto): Janne AAteigen, reporter\r\n01 navn|Ett navn (00:05, Manual/Auto): Jan Bang, kurator, Punktfestivalen\r\n01 navn|Ett navn (00:05, Manual/Auto): Erik Honoré, kurator, Punktfestivalen\r\n24 Foto/Redigering (00:05, Manual/Auto): Foto/teknikk:, Odd Rømteland\r\nStory status',
				'MOSSlugs' : 'LIVE RM1;Live-8\r\n01 navn|Ett navn (00:05, Manual/Auto): Janne AAteigen, reporter\r\nDIREKTE 1850;Live-22\r\nDIREKTE 1850;Live-23\r\n24 Foto/Redigering (00:05, Manual/Auto): Foto/teknikk:, Odd Rømteland\r\nLIVE;Live-5',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'StoryLogPreview' : '<BTS>< legg klippet her>\r\n<BTS>< legg klippet her>',
				'TextTime' : 0,
				'Bildebeskrivelse' : '',
				'mosartType' : 'DIR',
				'mosartVariant' : 1,
				'ReadTime' : 0,
				'Rettigheter' : 'Grønt',
				'Rettighetseier' : 'NRK',
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'ID' : '2',
				'ObjectID' : 'N12050_1466158375',
				'MOSID' : 'METADATA.NRK.MOS',
				'Slug' : 'LIVE RM1;Live-8',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://mosA4.com/mos/supported_schemas/MOSAXML2.08',
						'MosPayload' : {
							'nrk' : {
								'attributes' : {
									'changetime' : '2016-06-17T12:12:54 +02:00',
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
				'text' : '<BTS>< legg klippet her>',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : '<BTS>< legg klippet her>',
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
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '20',
				'ObjectID' : '2dbc4b27-46a1-4f1d-8c92-67ad13d8237f',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'fb4e089d-324a-4674-8d4c-6a49d207686d',
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
									'content' : 'Janne AAteigen, reporter',
									'full' : '01 navn|Ett navn (00:05, Manual/Auto): Janne AAteigen, reporter'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T12:09:14',
									'changed' : '2018-09-06-T12:09:14'
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
								'navn' : 'Janne AAteigen',
								'tittel' : 'reporter'
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
				'mosAbstract' : '01 navn|Ett navn (00:05, Manual/Auto): Janne AAteigen, reporter'
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
				'ID' : '22',
				'ObjectID' : 'be8755a2-48a5-41ac-bb66-947ff84c8966',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'DIREKTE 1850;Live-22',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'fb4e089d-324a-4674-8d4c-6a49d207686d',
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
									'content' : 'Jan Bang, kurator, Punktfestivalen',
									'full' : '01 navn|Ett navn (00:05, Manual/Auto): Jan Bang, kurator, Punktfestivalen'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T12:09:37',
									'changed' : '2018-09-06-T12:09:37'
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
								'navn' : 'Jan Bang',
								'tittel' : 'kurator, Punktfestivalen'
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
				'mosAbstract' : '01 navn|Ett navn (00:05, Manual/Auto): Jan Bang, kurator, Punktfestivalen'
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
				'ID' : '23',
				'ObjectID' : 'dfa924b7-44e8-45ab-892d-7d1f6634dc5a',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'DIREKTE 1850;Live-23',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'fb4e089d-324a-4674-8d4c-6a49d207686d',
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
									'content' : 'Erik Honoré, kurator, Punktfestivalen',
									'full' : '01 navn|Ett navn (00:05, Manual/Auto): Erik Honoré, kurator, Punktfestivalen'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T12:10:04',
									'changed' : '2018-09-06-T12:10:04'
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
								'navn' : 'Erik Honoré',
								'tittel' : 'kurator, Punktfestivalen'
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
				'mosAbstract' : '01 navn|Ett navn (00:05, Manual/Auto): Erik Honoré, kurator, Punktfestivalen'
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
				'ID' : '21',
				'ObjectID' : '4f62800e-684b-4d43-9815-bdb2885c337a',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : 'c82c0313-6c88-4e50-9771-421b58cbb0c1',
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
										'displayName' : '24 Foto/Redigering',
										'path' : '24_foto_red'
									}
								},
								'name' : {
									'time' : '(00:05, Manual/Auto)',
									'templateName' : '24 Foto/Redigering',
									'templateVariant' : '',
									'content' : 'Foto/teknikk:, Odd Rømteland',
									'full' : '24 Foto/Redigering (00:05, Manual/Auto): Foto/teknikk:, Odd Rømteland'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T12:10:26',
									'changed' : '2018-09-06-T12:10:26'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '24_foto_red',
								'layer' : 'super'
							},
							'content' : {
								'_valid' : true,
								'funksjon' : 'Foto/teknikk:',
								'navn' : 'Odd Rømteland',
								'funksjon2' : '',
								'navn2' : ''
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
				'mosAbstract' : '24 Foto/Redigering (00:05, Manual/Auto): Foto/teknikk:, Odd Rømteland'
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
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'LIVE;Live-5',
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
		}
	]
},{

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;64A9E81B-4F68-4D56-9DF80DAD1E313A30',
	'Slug' : 'KOMMER 2055;Kamera - ikke skriv her',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101612Z',
				'MOSObjSlugs' : 'Story status',
				'MOSSlugs' : 'STK SYNK;INTRO-3',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'StoryLogPreview' : '',
				'TextTime' : 0,
				'mosartType' : 'KAM',
				'mosartVariant' : 2,
				'ReadTime' : 0,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
	'Body' : [
		{
			'Type' : 'p',
			'Content' : {
				'text' : '[Merknad:Ikke slriv her]',
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
				'Slug' : 'STK SYNK;INTRO-3',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;13EE680A-D730-4E6C-B8F95DE7507AB3C9',
	'Slug' : 'KOMMER 2055;STK',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 15,
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101612Z',
				'MOSItemDurations' : '',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'M: \r\n22 Sted/Arkiv (00:00=>00:05, Auto/Auto)\r\n10 Tema|Vanlig (00:00, Auto/OnNext)\r\nStory status',
				'MOSSlugs' : 'STK SYNK 1;STK-10\r\nKOMMER 2055;STK-19\r\nKOMMER 2055;STK-20\r\nSTK SYNK 1;STK-12',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'TextTime' : 0,
				'mosartType' : 'STK',
				'ReadTime' : 0,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'ID' : '17',
				'ObjectID' : 'ENPSADM_1398418232',
				'MOSID' : 'METADATA.NRK.MOS',
				'Slug' : 'STK SYNK 1;STK-10',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://mosA4.com/mos/supported_schemas/MOSAXML2.08',
						'MosPayload' : {
							'nrk' : {
								'attributes' : {
									'type' : 'video',
									'changedBy' : 'ENPSADM',
									'changetime' : '2014-04-25T11:30:32 +02:00'
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
			'Type' : 'p',
			'Content' : {
				'text' : '< legg klippet her >',
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
				'ID' : '19',
				'ObjectID' : '060d650f-ef56-45f8-b9a5-8891c137bdf5',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'KOMMER 2055;STK-19',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '21b7a51a-c3c6-4325-9ea5-46e7128049d2',
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
										'displayName' : '22 Sted/Arkiv',
										'path' : '22_sted_arkiv'
									}
								},
								'name' : {
									'time' : '(00:00=>00:05, Auto/Auto)',
									'templateName' : '22 Sted/Arkiv',
									'templateVariant' : '',
									'content' : '',
									'full' : '22 Sted/Arkiv (00:00=>00:05, Auto/Auto)'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-08-30-T17:21:19',
									'changed' : '2018-08-30-T17:21:19'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '22_sted_arkiv',
								'layer' : 'tagLeft'
							},
							'content' : {
								'_valid' : false
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
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '22 Sted/Arkiv (00:00=>00:05, Auto/Auto)'
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
				'ID' : '20',
				'ObjectID' : '95bce67a-bd0a-4597-8353-51d85d6cf616',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'KOMMER 2055;STK-20',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '21b7a51a-c3c6-4325-9ea5-46e7128049d2',
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
										'displayName' : '10 Tema: Vanlig',
										'path' : '10_tema'
									}
								},
								'name' : {
									'time' : '(00:00, Auto/OnNext)',
									'templateName' : '10 Tema',
									'templateVariant' : 'Vanlig',
									'content' : '',
									'full' : '10 Tema|Vanlig (00:00, Auto/OnNext)'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-08-30-T17:21:29',
									'changed' : '2018-08-30-T17:21:29'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '10_tema',
								'layer' : 'tema'
							},
							'content' : {
								'_valid' : true,
								'tagtekst' : '#nrknyheter',
								'tematekst' : '',
								'infotekst' : ''
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
							'in' : 'auto',
							'out' : 'onNext'
						}
					}
				],
				'mosAbstract' : '10 Tema|Vanlig (00:00, Auto/OnNext)'
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
				'ID' : '18',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'STK SYNK 1;STK-12',
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
		}
	]
},{

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;CBC3F653-D7A8-4E1A-8B9A586BE6EB136B',
	'Slug' : 'KOMMER 2055;SYNK',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 15,
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101612Z',
				'MOSItemDurations' : '',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'M: \r\n01 navn|Ett navn (00:00=>00:05, Auto/Auto)\r\nStory status',
				'MOSSlugs' : 'STK SYNK;STK SYNK-2\r\nKOMMER 2055;SYNK-11\r\nSTK SYNK;STK SYNK-4',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'TextTime' : 0,
				'mosartType' : 'FULL',
				'ReadTime' : 0,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'ID' : '7',
				'ObjectID' : 'ENPSADM_1398418232',
				'MOSID' : 'METADATA.NRK.MOS',
				'Slug' : 'STK SYNK;STK SYNK-2',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://mosA4.com/mos/supported_schemas/MOSAXML2.08',
						'MosPayload' : {
							'nrk' : {
								'attributes' : {
									'type' : 'video',
									'changedBy' : 'ENPSADM',
									'changetime' : '2014-04-25T11:30:32 +02:00'
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
				'ID' : '11',
				'ObjectID' : '2715826f-1d37-4fc1-8dbb-d1577fe493fd',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'KOMMER 2055;SYNK-11',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '21b7a51a-c3c6-4325-9ea5-46e7128049d2',
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
									'time' : '(00:00=>00:05, Auto/Auto)',
									'templateName' : '01 navn',
									'templateVariant' : 'Ett navn',
									'content' : '',
									'full' : '01 navn|Ett navn (00:00=>00:05, Auto/Auto)'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-08-30-T17:21:42',
									'changed' : '2018-08-30-T17:21:42'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '01_navn',
								'layer' : 'super'
							},
							'content' : ''
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'text' : 0,
							'timeIn' : 0,
							'duration' : 5000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '01 navn|Ett navn (00:00=>00:05, Auto/Auto)'
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
				'ID' : '9',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'STK SYNK;STK SYNK-4',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;2FCC6FAD-9840-4C4A-B63342930BB64CA2',
	'Slug' : 'SEERBILDE;Kamera - ikke skriv her',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 3,
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101612Z',
				'MOSObjSlugs' : 'Story status',
				'MOSSlugs' : 'SAK 4;intro --2',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'TextTime' : 0,
				'mosartType' : 'KAM',
				'mosartVariant' : 1,
				'ReadTime' : 0,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : '<BTS SKJERM><klippet her: >',
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
				'Slug' : 'SAK 4;intro --2',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;0300B19A-BCA3-461C-9DE4A0FDAD901D53',
	'Slug' : 'SEERBILDE;SEERBILDE',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 15,
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101612Z',
				'MOSItemDurations' : '',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'M: Seerbilde\r\n101 Bilde (00:00, Auto/OnNext): Utsikt fra Vogts villa\r\nStory status',
				'MOSSlugs' : 'Uten tittel\r\n101 Bilde (00:00, Auto/OnNext): Utsikt fra Vogts villa\r\nSEERBILDE;SEERBILDE-8',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'TextTime' : 0,
				'Bildebeskrivelse' : '',
				'Innslagstittel' : 'Seerbilde',
				'mosartType' : 'GRAFIKK',
				'ReadTime' : 0,
				'Rettigheter' : 'Grønt',
				'Rettighetseier' : 'NRK',
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'ID' : '5',
				'ObjectID' : 'N12050_1466090430',
				'MOSID' : 'METADATA.NRK.MOS',
				'Slug' : 'Uten tittel',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://mosA4.com/mos/supported_schemas/MOSAXML2.08',
						'MosPayload' : {
							'nrk' : {
								'attributes' : {
									'changetime' : '2016-06-16T17:20:29 +02:00',
									'changedBy' : 'N12050',
									'type' : 'video',
									'mdSource' : 'ncs'
								},
								'title' : 'Seerbilde',
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
				'mosAbstract' : 'M: Seerbilde (16-06-16 17:20)',
				'ObjectSlug' : 'M: Seerbilde'
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
				'ID' : '8',
				'ObjectID' : 'a8c65d77-4260-45ff-b74e-6e8f937ac292',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '52b7b80c-c3d5-4c8f-b71e-54bd9e590ab9',
							'metadata' : {
								'modul' : 'nora.module.browser',
								'selection' : {
									'Design' : {
										'displayName' : 'Nyheter',
										'path' : 'http://nora.render.nyheter.mesosint.nrk.no'
									},
									'Type' : {
										'displayName' : 'fullskjerm',
										'path' : 'fullskjerm'
									},
									'Mal' : {
										'displayName' : '101 Bilde',
										'path' : '101_bilde'
									}
								},
								'name' : {
									'time' : '(00:00, Auto/OnNext)',
									'templateName' : '101 Bilde',
									'templateVariant' : '',
									'content' : 'Utsikt fra Vogts villa',
									'full' : '101 Bilde (00:00, Auto/OnNext): Utsikt fra Vogts villa'
								},
								'type' : 'fullskjerm',
								'userContext' : {
									'text' : '2018-09-06-T12:11:46',
									'changed' : '2018-09-06-T12:11:46'
								}
							},
							'template' : {
								'channel' : 'gfx2',
								'system' : 'html',
								'name' : '101_bilde',
								'layer' : 'fullskjerm'
							},
							'content' : {
								'_valid' : true,
								'bilde' : {
									'creators' : [
										'Foto: Gunnar Olsen',
										'Foto:Gunnar Olsen'
									],
									'credit' : 'NRK',
									'title' : 'Utsikt fra Vogts villa',
									'w' : 1,
									'format' : 'image/jpeg',
									'width' : 1920,
									'x' : 0,
									'h' : 1,
									'y' : 0,
									'id' : 'XkpEwcEtO7m_n8qRToXVhA',
									'type' : 'image/jpeg',
									'uri' : 'XkpEwcEtO7m_n8qRToXVhALdsHdfqbi878t0kRsSA5XA',
									'quality' : 0.9,
									'height' : 1080,
									'url' : 'https://gfx.nrk.no/XkpEwcEtO7m_n8qRToXVhALdsHdfqbi878t0kRsSA5XA'
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
							'in' : 'auto'
						}
					}
				],
				'mosAbstract' : '101 Bilde (00:00, Auto/OnNext): Utsikt fra Vogts villa'
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
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'SEERBILDE;SEERBILDE-8',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;6199E39F-10E5-498C-99D385A66738EB6A',
	'Slug' : 'VÆRET;Kamera - ikke skriv her',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101612Z',
				'MOSObjSlugs' : 'Story status',
				'MOSSlugs' : 'STK SYNK;INTRO-3',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'StoryLogPreview' : '',
				'TextTime' : 0,
				'mosartType' : 'KAM',
				'mosartVariant' : 1,
				'ReadTime' : 0,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
	'Body' : [
		{
			'Type' : 'p',
			'Content' : {
				'text' : '[Merknad:Ikke slriv her]',
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
				'Slug' : 'STK SYNK;INTRO-3',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;97E82D60-CC71-4390-AB9765A11985F1AE',
	'Slug' : 'VÆRET;VERET-LØRDAG-310818S-SL',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 12,
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101612Z',
				'MOSItemDurations' : '14,76',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'M: Været\r\nVERET-LØRDAG-310818S-SL\r\n81 Ticker|Vanlig (00:00=>00:03, Auto/Auto): Værdata er levert av Meteorologisk institutt\r\nStory status',
				'MOSSlugs' : 'STK SYNK 1;STK-10\r\nVÆRET;VERET-LØRDAG-310818S-SL-14\r\nVÆRET;Været-15\r\nSTK SYNK 1;STK-12',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'TextTime' : 0,
				'mosartType' : 'STK',
				'ReadTime' : 0,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'ID' : '2',
				'ObjectID' : 'N11683_1514888144',
				'MOSID' : 'METADATA.NRK.MOS',
				'Slug' : 'STK SYNK 1;STK-10',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://mosA4.com/mos/supported_schemas/MOSAXML2.08',
						'MosPayload' : {
							'nrk' : {
								'attributes' : {
									'changetime' : '2018-01-02T11:15:43 +01:00',
									'changedBy' : 'N11683',
									'type' : 'video',
									'mdSource' : 'omnibus'
								},
								'title' : 'Været',
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
				'mosAbstract' : 'M: Været (02-01-18 11:15)',
				'ObjectSlug' : 'M: Været'
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
				'text' : '< legg klippet her',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '14',
				'ObjectID' : '\\\\NDSL\\Omn\\D\\C\\07\\64',
				'MOSID' : 'OMNIBUS.NDSL.MOS',
				'Slug' : 'VÆRET;VERET-LØRDAG-310818S-SL-14',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'OMNIBUS',
						'MosPayload' : {
							'title' : 'veret-lørdag',
							'objectType' : 'CLIP',
							'clipType' : 'NYHETER_STK',
							'objDur' : 738
						}
					}
				],
				'mosAbstract' : 'VERET-LØRDAG-310818S-SL NYHETER_STK 00:00:14:19',
				'ObjectSlug' : 'VERET-LØRDAG-310818S-SL',
				'Duration' : 738,
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
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '15',
				'ObjectID' : 'a7272f17-2045-411e-b3f8-1df4107177b8',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'VÆRET;Været-15',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '9eafea99-1ed2-4456-aebb-e1b1edc462fa',
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
										'displayName' : '81 Ticker: Vanlig',
										'path' : '81_ticker_info'
									}
								},
								'name' : {
									'time' : '(00:00=>00:03, Auto/Auto)',
									'templateName' : '81 Ticker',
									'templateVariant' : 'Vanlig',
									'content' : 'Værdata er levert av Meteorologisk institutt',
									'full' : '81 Ticker|Vanlig (00:00=>00:03, Auto/Auto): Værdata er levert av Meteorologisk institutt'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-04-T13:48:00',
									'changed' : '2018-09-04-T13:48:00'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '81_ticker_info',
								'layer' : 'ticker'
							},
							'content' : {
								'_valid' : true,
								'text' : 'Værdata er levert av Meteorologisk institutt',
								'infotekst' : 'Værdata er levert av Meteorologisk institutt'
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'text' : 0,
							'timeIn' : 0,
							'duration' : 3000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '81 Ticker|Vanlig (00:00=>00:03, Auto/Auto): Værdata er levert av Meteorologisk institutt'
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
				'ID' : '4',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'STK SYNK 1;STK-12',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;C49FF15C-F113-4BD0-B01C4D901A074CC6',
	'Slug' : 'VÆRET;VERET-SØNDAG-310818S-SL',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101612Z',
				'MOSItemDurations' : '15,04',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : 'M: \r\nVERET-SØNDAG-310818S-SL\r\n81 Ticker|Vanlig (00:00=>00:03, Auto/Auto): Værdata er levert av Meteorologisk institutt\r\nStory status',
				'MOSSlugs' : 'STK SYNK 1;STK-10\r\nVÆRET;VERET-SØNDAG-310818S-SL-2\r\nVÆRET;Været-15\r\nSTK SYNK 1;STK-12',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'StoryLogPreview' : '< legg klippet her >',
				'TextTime' : 0,
				'mosartTransition' : 'mix 12',
				'mosartType' : 'STK',
				'ReadTime' : 0,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
				'ID' : '5',
				'ObjectID' : 'ENPSADM_1398418232',
				'MOSID' : 'METADATA.NRK.MOS',
				'Slug' : 'STK SYNK 1;STK-10',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://mosA4.com/mos/supported_schemas/MOSAXML2.08',
						'MosPayload' : {
							'nrk' : {
								'attributes' : {
									'type' : 'video',
									'changedBy' : 'ENPSADM',
									'changetime' : '2014-04-25T11:30:32 +02:00'
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
				'text' : '< legg klippet her',
				'@name' : 'p',
				'@type' : 'text'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '2',
				'ObjectID' : '\\\\NDSL\\Omn\\D\\C\\07\\65',
				'MOSID' : 'OMNIBUS.NDSL.MOS',
				'Slug' : 'VÆRET;VERET-SØNDAG-310818S-SL-2',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'OMNIBUS',
						'MosPayload' : {
							'title' : 'veret-søndag',
							'objectType' : 'CLIP',
							'clipType' : 'NYHETER_STK',
							'objDur' : 752,
							'objType' : 'VIDEO'
						}
					}
				],
				'mosAbstract' : 'VERET-SØNDAG-310818S-SL NYHETER_STK 00:00:15:01',
				'ObjectSlug' : 'VERET-SØNDAG-310818S-SL',
				'Duration' : 752,
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
				'@name' : 'p',
				'@type' : 'element'
			}
		},
		{
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '10',
				'ObjectID' : 'a7272f17-2045-411e-b3f8-1df4107177b8',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'VÆRET;Været-15',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '9eafea99-1ed2-4456-aebb-e1b1edc462fa',
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
										'displayName' : '81 Ticker: Vanlig',
										'path' : '81_ticker_info'
									}
								},
								'name' : {
									'time' : '(00:00=>00:03, Auto/Auto)',
									'templateName' : '81 Ticker',
									'templateVariant' : 'Vanlig',
									'content' : 'Værdata er levert av Meteorologisk institutt',
									'full' : '81 Ticker|Vanlig (00:00=>00:03, Auto/Auto): Værdata er levert av Meteorologisk institutt'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-04-T13:48:00',
									'changed' : '2018-09-04-T13:48:00'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '81_ticker_info',
								'layer' : 'ticker'
							},
							'content' : {
								'_valid' : true,
								'text' : 'Værdata er levert av Meteorologisk institutt',
								'infotekst' : 'Værdata er levert av Meteorologisk institutt'
							}
						}
					},
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/timing',
						'MosPayload' : {
							'text' : 0,
							'timeIn' : 0,
							'duration' : 3000,
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '81 Ticker|Vanlig (00:00=>00:03, Auto/Auto): Værdata er levert av Meteorologisk institutt'
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
				'ID' : '9',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'STK SYNK 1;STK-12',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;C2FEF5F5-AD4D-4BCA-A854A65DD8558F6C',
	'Slug' : 'TAKK FOR IDAG;tekst - takk for nå.',
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
				'ModTime' : '20180906T101612Z',
				'MOSItemDurations' : '',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : '81 Ticker|Vanlig (00:00, Auto/OnNext): nrk.no/sorlandet\r\nStory status',
				'MOSSlugs' : 'TAKK FOR IDAG;tekst - takk for nå.-12\r\nTAKK FOR IDAG;tekst - takk for nå.-4',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'TextTime' : 0,
				'mosartType' : 'KAM',
				'mosartVariant' : 1,
				'ReadTime' : 0,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '12',
				'ObjectID' : '8ad8b38b-c6bb-410b-b713-5c2a30b6775a',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : 'TAKK FOR IDAG;tekst - takk for nå.-12',
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
										'displayName' : '81 Ticker: Vanlig',
										'path' : '81_ticker_info'
									}
								},
								'name' : {
									'time' : '(00:00, Auto/OnNext)',
									'templateName' : '81 Ticker',
									'templateVariant' : 'Vanlig',
									'content' : 'nrk.no/sorlandet',
									'full' : '81 Ticker|Vanlig (00:00, Auto/OnNext): nrk.no/sorlandet'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-08-30-T17:24:15',
									'changed' : '2018-08-30-T17:24:15'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '81_ticker_info',
								'layer' : 'ticker'
							},
							'content' : {
								'_valid' : true,
								'text' : 'nrk.no/sorlandet',
								'infotekst' : 'nrk.no/sorlandet'
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
							'in' : 'auto',
							'out' : 'onNext'
						}
					}
				],
				'mosAbstract' : '81 Ticker|Vanlig (00:00, Auto/OnNext): nrk.no/sorlandet'
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
				'ID' : '3',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'TAKK FOR IDAG;tekst - takk for nå.-4',
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

	'ID' : 'SLENPS01;P_NDSL\\W\\R_68E40DE6-2D08-487D-BE80889DAE999E83;4D07D9A5-3BA9-4028-BA53A55433792C8B',
	'Slug' : 'TAKK FOR IDAG;SLUTTKREDITT LUKKING',
	'MosExternalMetaData' : [
		{
			'MosScope' : 'PLAYLIST',
			'MosSchema' : 'http://SLENPS01:10505/schema/enps.dtd',
			'MosPayload' : {
				'text' : 0,
				'Approved' : 0,
				'Creator' : 'N12050',
				'Estimated' : 14,
				'MediaTime' : 0,
				'ModBy' : 'N12050',
				'ModTime' : '20180906T101612Z',
				'MOSItemDurations' : '',
				'MOSItemEdDurations' : '',
				'MOSObjSlugs' : '68 Sluttkred (00:00=>00:05, Auto/Auto): Redaktør:, Morten Rød | Regi:, Asbjørn Odd Berge | ,  | 03030@nrk.no\r\nStory status',
				'MOSSlugs' : '68 Sluttkred (00:00=>00:05, Auto/Auto): Redaktør:, Morten Rød | Regi:, Asbjørn Odd Berge | ,  | 03030@nrk.no\r\nTAKK FOR I DAG;SLUTTKREDITT LUKKING-5',
				'MOSStatus' : '',
				'Owner' : 'N12050',
				'SourceMediaTime' : 0,
				'SourceTextTime' : 0,
				'TextTime' : 0,
				'mosartTransition' : 'mix 12',
				'mosartType' : 'KAM',
				'mosartVariant' : 'SLUTT4',
				'ReadTime' : 0,
				'ENPSItemType' : 3
			}
		}
	],
	'RunningOrderId' : 'SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-BE80889DAE999E83',
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
			'Type' : 'storyItem',
			'Content' : {
				'ID' : '9',
				'ObjectID' : '73d4c02e-d2a9-445d-aceb-5e698da72a20',
				'MOSID' : 'GFX.NRK.MOS',
				'Slug' : '[object Object]',
				'MosExternalMetaData' : [
					{
						'MosScope' : 'PLAYLIST',
						'MosSchema' : 'http://nora.core.mesosint.nrk.no/mos/content',
						'MosPayload' : {
							'uuid' : '4fd02b28-72f1-4321-8247-5c15fc471e0f',
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
										'displayName' : '68 Sluttkredit',
										'path' : '68_sluttkred_kort'
									}
								},
								'name' : {
									'time' : '(00:00=>00:05, Auto/Auto)',
									'templateName' : '68 Sluttkred',
									'templateVariant' : '',
									'content' : 'Redaktør:, Morten Rød | Regi:, Asbjørn Odd Berge | , | 03030@nrk.no',
									'full' : '68 Sluttkred (00:00=>00:05, Auto/Auto): Redaktør:, Morten Rød | Regi:, Asbjørn Odd Berge | , | 03030@nrk.no'
								},
								'type' : 'super',
								'userContext' : {
									'text' : '2018-09-06-T12:15:10',
									'changed' : '2018-09-06-T12:15:10'
								}
							},
							'template' : {
								'channel' : 'gfx1',
								'system' : 'html',
								'name' : '68_sluttkred_kort',
								'layer' : 'fullskjerm'
							},
							'content' : {
								'_valid' : true,
								'funksjon' : 'Redaktør:',
								'navn' : 'Morten Rød',
								'funksjon2' : 'Regi:',
								'navn2' : 'Asbjørn Odd Berge',
								'funksjon3' : '',
								'navn3' : '',
								'nettadresse' : '03030@nrk.no'
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
							'in' : 'auto',
							'out' : 'auto'
						}
					}
				],
				'mosAbstract' : '68 Sluttkred (00:00=>00:05, Auto/Auto): Redaktør:, Morten Rød | Regi:, Asbjørn Odd Berge | , | 03030@nrk.no'
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
				'ID' : '3',
				'ObjectID' : 'STORYSTATUS',
				'MOSID' : 'mosart.morten.mos',
				'Slug' : 'TAKK FOR I DAG;SLUTTKREDITT LUKKING-5',
				'mosAbstract' : 'TIDSMARKØR IKKE RØR',
				'ObjectSlug' : 'Story status'
			}
		},
		{
			'Type' : 'p',
			'Content' : {
				'text' : '<',
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
			'Type' : 'p',
			'Content' : {
				'text' : 'Asbjørn Odd Berge',
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
				'text' : 'Eirik Damsgaard',
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
				'text' : 'Frans Kjetså',
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
				'text' : 'Geir Ingar Egeland',
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
				'text' : 'Hans Erik Weiby',
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
				'text' : 'Jan Jørg Tomstad',
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
				'text' : 'Knut Knudsen Eigeland',
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
				'text' : 'Lars Gunnar Eie',
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
				'text' : 'Liv Eva Welhaven Løchen',
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
				'text' : 'Morten Rosenvinge',
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
				'text' : 'Sander Heggheim',
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
				'text' : 'Sigtor Kjetså',
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
				'text' : 'Siv Kristin Sællmann',
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
				'text' : 'Tom Nicolai Kolstad',
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
				'text' : 'Tom-Richard H. Olsen',
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
				'text' : 'Åse Røysland',
				'@name' : 'p',
				'@type' : 'text'
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
			'Type' : 'p',
			'Content' : {
				'@name' : 'p',
				'@type' : 'element'
			}
		}
	]
}]
