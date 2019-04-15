import { DBSegment } from '../../../lib/collections/Segments'
import { Rundown, DBRundown } from '../../../lib/collections/Rundowns'
import { DBSegmentLine } from '../../../lib/collections/SegmentLines'
import { Piece } from '../../../lib/collections/Pieces'
import { literal } from '../../../lib/lib'

export interface MockRO {
	rundown: Rundown,
	segments: Array<DBSegment>,
	segmentLines: Array<DBSegmentLine>,
	pieces: Array<Piece>,
}

export const testRO1: MockRO = {
	rundown: new Rundown(literal<DBRundown>({
		_id: 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
		externalId: '',
		studioInstallationId: '',
		showStyleBaseId: '',
		showStyleVariantId: '',
		peripheralDeviceId: '',
		name: 'Infinite Mock 1',
		created: 0,
		modified: 0,
		previousSegmentLineId: null,
		currentSegmentLineId: null,
		nextSegmentLineId: null,
		dataSource: '',
		importVersions: {
			studioInstallation: '',
			showStyleBase: '',
			showStyleVariant: '',
			blueprint: '',
			core: ''
		}
	})),
	segments: [
		{
			'_id': '6kb7AuZaDD5Ao_CGeOoYNgjk4uU_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 1,
			'externalId': '',
			'name': 'BYVEKST AVTALE'
		},
		{
			'_id': 'tIvBNK46jZgZ6RbB8G7Q0RwttIY_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 0,
			'externalId': '',
			'name': 'VIGNETT'
		},
		{
			'_id': 'sjZOWRQEV4YMFCCEVo24IG8yHzg_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 2,
			'externalId': '',
			'name': 'GJEST'
		},
		{
			'_id': '5gnIW3D21_T_OBA8I9VVT_L3DIE_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 3,
			'externalId': '',
			'name': 'SYKKEL VEI'
		},
		{
			'_id': 'PZ7S4nZrGfQYcjN6G21kkAn9PxY_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 4,
			'externalId': '',
			'name': 'PADLERE'
		},
		{
			'_id': 'KfgYowajVA_cXg8UzQE3MRrdWOM_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 6,
			'externalId': '',
			'name': 'KOMMER 2055'
		},
		{
			'_id': 'MXqlF3LNzJeAHkkLozXc5jNJwEE_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 5,
			'externalId': '',
			'name': 'DIREKTE PUNKT FESTIVAL'
		},
		{
			'_id': '18J8ymz6_XVRPRyBkqEh4a_HT_k_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 7,
			'externalId': '',
			'name': 'SEERBILDE'
		},
		{
			'_id': 'mMTQmzfQViEj2LHGSOdl1NvdWFQ_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 8,
			'externalId': '',
			'name': 'VÆRET'
		},
		{
			'_id': 'sC4hfTUMutgKQnG_QrH0nBjbP_0_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 9,
			'externalId': '',
			'name': 'TAKK FOR IDAG'
		}
	]
	,
	segmentLines: [
		{
			'_id': 'GuR5i3ccRRKVhdOtOmgzP8Coeqs_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'tIvBNK46jZgZ6RbB8G7Q0RwttIY_',
			'_rank': 0,
			'externalId': '',
			'title': 'VIGNETT;Vignett',
			'typeVariant': 'vignett',
			'expectedDuration': 13240,
			'subTypeVariant': ''
		},
		{
			'_id': 'bzwmGuXuSSg_dRHhlNDFNNl1_Js_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'tIvBNK46jZgZ6RbB8G7Q0RwttIY_',
			'_rank': 1,
			'externalId': '',
			'title': 'VIGNETT;Head 1',
			'typeVariant': 'head',
			'expectedDuration': 8880,
			'subTypeVariant': ''
		},
		{
			'_id': 'qGi_A8A0NtZoSgNnYZVNI_Vb700_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'tIvBNK46jZgZ6RbB8G7Q0RwttIY_',
			'_rank': 2,
			'externalId': '',
			'title': 'VIGNETT;Head 2',
			'typeVariant': 'head',
			'expectedDuration': 19960,
			'subTypeVariant': ''
		},
		{
			'_id': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'tIvBNK46jZgZ6RbB8G7Q0RwttIY_',
			'_rank': 3,
			'externalId': '',
			'title': 'VIGNETT;Velkommen med super',
			'typeVariant': 'kam',
			'expectedDuration': 4880,
			'subTypeVariant': ''
		},
		{
			'_id': 'kjW9GfMhvvh_CdSnBrnQmd9WBOk_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': '6kb7AuZaDD5Ao_CGeOoYNgjk4uU_',
			'_rank': 4,
			'externalId': '',
			'title': 'BYVEKST AVTALE;intrundown -',
			'typeVariant': 'kam',
			'expectedDuration': 14000,
			'subTypeVariant': ''
		},
		{
			'_id': '2yKRioTfVGnRztaYBn3uW013U7M_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': '6kb7AuZaDD5Ao_CGeOoYNgjk4uU_',
			'_rank': 5,
			'externalId': '',
			'title': 'BYVEKST AVTALE;BYVEKST-AVTALE-300818-SL',
			'typeVariant': 'full',
			'expectedDuration': 8560,
			'subTypeVariant': ''
		},
		{
			'_id': 'IomGMc7Zfwxem69eqqvlMjRSj9E_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'sjZOWRQEV4YMFCCEVo24IG8yHzg_',
			'_rank': 6,
			'externalId': '',
			'title': 'GJEST;Intrundown',
			'typeVariant': 'kam',
			'expectedDuration': 4880,
			'subTypeVariant': ''
		},
		{
			'_id': 'saTW13T4_wBQQIXXw9J1dRU0XXw_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': '5gnIW3D21_T_OBA8I9VVT_L3DIE_',
			'_rank': 8,
			'externalId': '',
			'title': 'SYKKEL VEI;intrundown -',
			'typeVariant': 'kam',
			'expectedDuration': 13000,
			'subTypeVariant': ''
		},
		{
			'_id': 'R0HMkiSy38MascKSmom2ovahStc_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'sjZOWRQEV4YMFCCEVo24IG8yHzg_',
			'_rank': 7,
			'externalId': '',
			'title': 'GJEST;GJEST-',
			'typeVariant': 'kam',
			'expectedDuration': 29880,
			'subTypeVariant': ''
		},
		{
			'_id': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': '5gnIW3D21_T_OBA8I9VVT_L3DIE_',
			'_rank': 9,
			'externalId': '',
			'title': 'SYKKEL VEI;SYKKEL-VEI-310818-SL',
			'typeVariant': 'full',
			'expectedDuration': 110920,
			'subTypeVariant': ''
		},
		{
			'_id': 'BNx_pjsUS_NZmV8z_YmAT_C0riU_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'PZ7S4nZrGfQYcjN6G21kkAn9PxY_',
			'_rank': 10,
			'externalId': '',
			'title': 'PADLERE;Kamera - ikke skriv her',
			'typeVariant': 'kam',
			'expectedDuration': 3000,
			'subTypeVariant': ''
		},
		{
			'_id': 'rUiB1GP4V671z_rYY03v1eM_icQ_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'PZ7S4nZrGfQYcjN6G21kkAn9PxY_',
			'_rank': 11,
			'externalId': '',
			'title': 'PADLERE;PADLERE-300818S-SL',
			'typeVariant': 'stk',
			'expectedDuration': 21000,
			'subTypeVariant': ''
		},
		{
			'_id': '3_qhlFEIYlESrvZYxbk3ie_5_z0_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'PZ7S4nZrGfQYcjN6G21kkAn9PxY_',
			'_rank': 12,
			'externalId': '',
			'title': 'PADLERE;PADLERE-300818F-SL',
			'typeVariant': 'full',
			'expectedDuration': 9240,
			'subTypeVariant': ''
		},
		{
			'_id': 'Q5fb7VHFWQZjgdUQ_AD9QZjrknk_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'MXqlF3LNzJeAHkkLozXc5jNJwEE_',
			'_rank': 13,
			'externalId': '',
			'title': 'DIREKTE PUNKT FESTIVAL;intrundown -',
			'typeVariant': 'kam',
			'expectedDuration': 9000,
			'subTypeVariant': ''
		},
		{
			'_id': 'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'MXqlF3LNzJeAHkkLozXc5jNJwEE_',
			'_rank': 15,
			'externalId': '',
			'title': 'DIREKTE PUNKT FESTIVAL;Split',
			'typeVariant': 'split',
			'expectedDuration': 4000,
			'subTypeVariant': '',
			'stoppedPlayback': true
		},
		{
			'_id': 'W3bcE_DKgzZwoq17RsaKBn3__yc_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'MXqlF3LNzJeAHkkLozXc5jNJwEE_',
			'_rank': 14,
			'externalId': '',
			'title': 'DIREKTE PUNKT FESTIVAL;PUNKTFESTIVALE-300818S-SL',
			'typeVariant': 'stk',
			'expectedDuration': 11800,
			'subTypeVariant': ''
		},
		{
			'_id': 'kPKjHD_z3qXD35LqPOD314lOSPo_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'MXqlF3LNzJeAHkkLozXc5jNJwEE_',
			'_rank': 16,
			'externalId': '',
			'title': 'DIREKTE PUNKT FESTIVAL;Live',
			'typeVariant': 'dir',
			'expectedDuration': 0,
			'subTypeVariant': ''
		},
		{
			'_id': 'MTwVEbe90uguNcecrum5tqVLzWg_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'KfgYowajVA_cXg8UzQE3MRrdWOM_',
			'_rank': 17,
			'externalId': '',
			'title': 'KOMMER 2055;Kamera - ikke skriv her',
			'typeVariant': 'kam',
			'expectedDuration': 0,
			'subTypeVariant': ''
		},
		{
			'_id': 'nArzKAkxPONWUVchEVB4o1Q4VsE_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'KfgYowajVA_cXg8UzQE3MRrdWOM_',
			'_rank': 18,
			'externalId': '',
			'title': 'KOMMER 2055;STK',
			'typeVariant': 'stk',
			'expectedDuration': 15000,
			'subTypeVariant': ''
		},
		{
			'_id': 'UoSeVe3h1b67aSun_UMUSSz9NZw_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'KfgYowajVA_cXg8UzQE3MRrdWOM_',
			'_rank': 19,
			'externalId': '',
			'title': 'KOMMER 2055;SYNK',
			'typeVariant': 'full',
			'expectedDuration': 15000,
			'subTypeVariant': ''
		},
		{
			'_id': 'cq9VY7XbnFhpZGSr0q5tfvOx5gs_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': '18J8ymz6_XVRPRyBkqEh4a_HT_k_',
			'_rank': 20,
			'externalId': '',
			'title': 'SEERBILDE;Kamera - ikke skriv her',
			'typeVariant': 'kam',
			'expectedDuration': 3000,
			'subTypeVariant': ''
		},
		{
			'_id': 'gRQFPOgXaV7r_WqgNCPqVcAvsGc_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': '18J8ymz6_XVRPRyBkqEh4a_HT_k_',
			'_rank': 21,
			'externalId': '',
			'title': 'SEERBILDE;SEERBILDE',
			'typeVariant': 'grafikk',
			'expectedDuration': 15000,
			'subTypeVariant': ''
		},
		{
			'_id': 'zZPFW5kV_Cy1w_NeZX7nvAGxFSQ_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'mMTQmzfQViEj2LHGSOdl1NvdWFQ_',
			'_rank': 22,
			'externalId': '',
			'title': 'VÆRET;Kamera - ikke skriv her',
			'typeVariant': 'kam',
			'expectedDuration': 0,
			'subTypeVariant': ''
		},
		{
			'_id': '1WWrqgLIvlxNE4ciwOSL2Qn2yCI_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'mMTQmzfQViEj2LHGSOdl1NvdWFQ_',
			'_rank': 23,
			'externalId': '',
			'title': 'VÆRET;VERET-LØRDAG-310818S-SL',
			'typeVariant': 'grafikk',
			'expectedDuration': 15000,
			'subTypeVariant': ''
		},
		{
			'_id': 'jh3nz3Le_21YJMCMTZ_uwp6smDY_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'mMTQmzfQViEj2LHGSOdl1NvdWFQ_',
			'_rank': 24,
			'externalId': '',
			'title': 'VÆRET;VERET-SØNDAG-310818S-SL',
			'typeVariant': 'stk',
			'expectedDuration': 0,
			'subTypeVariant': ''
		},
		{
			'_id': 'gtWWWXdaRUM3KfiXAWoRUN879a8_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'sC4hfTUMutgKQnG_QrH0nBjbP_0_',
			'_rank': 25,
			'externalId': '',
			'title': 'TAKK FOR IDAG;tekst - takk for nå.',
			'typeVariant': 'kam',
			'expectedDuration': 5000,
			'subTypeVariant': ''
		},
		{
			'_id': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'sC4hfTUMutgKQnG_QrH0nBjbP_0_',
			'_rank': 26,
			'externalId': '',
			'title': 'TAKK FOR IDAG;SLUTTKREDITT LUKKING',
			'typeVariant': 'kam',
			'expectedDuration': 13540,
			'subTypeVariant': ''
		}
	],
	pieces: [
		{
			'_id': 'NowSlQNWBLo1CnTRDxU9gxupE38_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'GuR5i3ccRRKVhdOtOmgzP8Coeqs_',
			'status': -1,
			'externalId': '',
			'name': 'Vignett',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_vignett',
			'outputLayerId': 'pgm0',
			'expectedDuration': 14240,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '9wPCrktBThPitm0JiE7FIOuoRJo_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'GuR5i3ccRRKVhdOtOmgzP8Coeqs_',
			'status': -1,
			'externalId': '',
			'name': 'Vignett bed',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_audio_bed',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 2,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '4QCyxcifIpEHXWQW5mHEnja9vYQ_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'GuR5i3ccRRKVhdOtOmgzP8Coeqs_',
			'status': -1,
			'externalId': '',
			'name': 'Record',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_hyperdeck0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 3,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'I_8V2cc_R5DZDlokxeXKYwlkwIo_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'bzwmGuXuSSg_dRHhlNDFNNl1_Js_',
			'status': -1,
			'externalId': '',
			'name': '(…||…nye bomstasjoner.\n)',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_script',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'NOm1Mz2GMYo_jfG3kMHNvkH91BI_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'bzwmGuXuSSg_dRHhlNDFNNl1_Js_',
			'status': -1,
			'externalId': '',
			'name': 'HEAD-BYVEKST-300818S-SL',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'infiniteMode': 1,
			'sourceLayerId': 'studio0_live_speak0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'adlibPreroll': 320,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'rbAshSKgAXNjI8q8yHkFXz6Dry8_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'bzwmGuXuSSg_dRHhlNDFNNl1_Js_',
			'status': -1,
			'externalId': '',
			'name': 'W1',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_live_transition0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 3300,
			'isTransition': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'qcIUFY0abKSsUhYZ55KkDZU1OBU_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'bzwmGuXuSSg_dRHhlNDFNNl1_Js_',
			'status': -1,
			'externalId': '',
			'name': 'Frykter tap av millioner',
			'trigger': {
				'type': 1,
				'value': '#piece_group_NOm1Mz2GMYo_jfG3kMHNvkH91BI_.start + 0'
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 2,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'NNrxLdnNEH_U_zMCREASM60Fr2k_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'qGi_A8A0NtZoSgNnYZVNI_Vb700_',
			'status': -1,
			'externalId': '',
			'name': '(Skriv tekst her:…||…til jobb.\n.',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_script',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'nMkRoyy19ZwUn90QY18xhnQ1ouM_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'qGi_A8A0NtZoSgNnYZVNI_Vb700_',
			'status': -1,
			'externalId': '',
			'name': 'zz-tirsdag-b_000_15481653457966',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'infiniteMode': 1,
			'sourceLayerId': 'studio0_live_speak0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'adlibPreroll': 320,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '8wvQamEm_XUCCmv2baLc_E73zXo_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'qGi_A8A0NtZoSgNnYZVNI_Vb700_',
			'status': -1,
			'externalId': '',
			'name': 'W1',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_live_transition0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 3300,
			'isTransition': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'zXU6HCl7N3v9v8ur9F8RqFO_1M8_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'qGi_A8A0NtZoSgNnYZVNI_Vb700_',
			'status': -1,
			'externalId': '',
			'name': 'Ny sykkelvei til 80 millioner',
			'trigger': {
				'type': 1,
				'value': '#piece_group_nMkRoyy19ZwUn90QY18xhnQ1ouM_.start + 0'
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 2,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '__RRnX1FKXGonKEcFl06W_SvthI_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'externalId': '',
			'name': '2',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_camera0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'NbUV7JvLIzjtsk_00XUFwfEPrL8_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'externalId': '',
			'name': '[AUTOMATION:CG\\programTab\\blah blah blah\\breaking\\Of…||…blah blah\\breaking\\Of doom\\\\\\\\\\2000:auto:5000\\AUTOMATIC]',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_script',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'uytgQp4_dhqyKbnPEvnWyFPymx8_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'externalId': '',
			'name': 'W1p',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_live_transition0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 3700,
			'isTransition': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'WuaX_RP_keOMe2L7q1oVgQH7AOg_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'externalId': '',
			'name': '50 Logo (00:00, Auto/Manual)',
			'trigger': {
				'type': 1,
				'value': '#piece_group___RRnX1FKXGonKEcFl06W_SvthI_.start + 0'
			},
			'sourceLayerId': 'studio0_graphics_logo',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 3,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '1Vf17ep1XE2bcAAUrokLfiAbohg_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'externalId': '',
			'name': '51 Klokke (00:00, Auto/Manual)',
			'trigger': {
				'type': 1,
				'value': '#piece_group___RRnX1FKXGonKEcFl06W_SvthI_.start + 0'
			},
			'sourceLayerId': 'studio0_graphics_klokke',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 3,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '7BqlHCG2jamqJ7u2hdBBwCVrw9A_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'externalId': '',
			'name': 'Lars Eie',
			'trigger': {
				'type': 1,
				'value': '#piece_group___RRnX1FKXGonKEcFl06W_SvthI_.start + 1000'
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 5000,
			'isTransition': false,
			'infiniteMode': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'wXo1T_uGE3GDTHtFU7aIHL7GH6E_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'externalId': '',
			'name': '',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'virtual': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ__bed_fade',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'externalId': '',
			'name': 'Vignett Bed Fade',
			'trigger': {
				'type': 0,
				'value': 440
			},
			'sourceLayerId': 'studio0_audio_bed',
			'outputLayerId': 'pgm0',
			'expectedDuration': 160,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '6a0SIN5JtjSSL_XofAJoRCoaMPA_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'kjW9GfMhvvh_CdSnBrnQmd9WBOk_',
			'status': -1,
			'externalId': '',
			'name': '2',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_camera0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'KgZaPjpNWtfiMeBOLK_K_KD_aSc_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'kjW9GfMhvvh_CdSnBrnQmd9WBOk_',
			'status': -1,
			'externalId': '',
			'name': '[AUTOMATION:CG\\mainStrap\\Julian Waller\\Breaker of…||…statlige millioner. /S/',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_script',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'Z3DAd2PGUvvF_M1Ih25F_F5MVjY_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '2yKRioTfVGnRztaYBn3uW013U7M_',
			'status': -1,
			'externalId': '',
			'name': 'blah blah blah -2dB',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_vb',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'isTransition': false,
			'adlibPreroll': 320,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'Jfh9TyTT_1pWI1h65xnnWLtjP1Y_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '2yKRioTfVGnRztaYBn3uW013U7M_',
			'status': -1,
			'externalId': '',
			'name': 'Anne Wirsching, reporter',
			'trigger': {
				'type': 1,
				'value': '#piece_group_Z3DAd2PGUvvF_M1Ih25F_F5MVjY_.start + 2000'
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 5000,
			'isTransition': false,
			'infiniteMode': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'YFFDgk_tSFZDTuU97YcxtvZ3t0U_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '2yKRioTfVGnRztaYBn3uW013U7M_',
			'status': -1,
			'externalId': '',
			'name': 'Harald Furre, ordfører Kristiansand (H)',
			'trigger': {
				'type': 1,
				'value': '#piece_group_Z3DAd2PGUvvF_M1Ih25F_F5MVjY_.start + 18000'
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 5000,
			'isTransition': false,
			'infiniteMode': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'qIz1lF3pn3fQNtr3OV6E_NacDl8_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '2yKRioTfVGnRztaYBn3uW013U7M_',
			'status': -1,
			'externalId': '',
			'name': 'Foto/redigering:, Anne Wirsching',
			'trigger': {
				'type': 1,
				'value': '#piece_group_Z3DAd2PGUvvF_M1Ih25F_F5MVjY_.start + 103000'
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 5000,
			'isTransition': false,
			'infiniteMode': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'yQUX6Ai126rxxvkhkoiIuzJuyrs_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '2yKRioTfVGnRztaYBn3uW013U7M_',
			'status': -1,
			'externalId': '',
			'name': 'Mette Gundersen, gruppeleder, Arbeiderpartiet, Kristiansand',
			'trigger': {
				'type': 1,
				'value': '#piece_group_Z3DAd2PGUvvF_M1Ih25F_F5MVjY_.start + 34000'
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 5000,
			'isTransition': false,
			'infiniteMode': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'SeJdy1j4BZd0n6bwBvKbBC9G1gA_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'IomGMc7Zfwxem69eqqvlMjRSj9E_',
			'status': -1,
			'externalId': '',
			'name': '1',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_camera0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'NiPAyXp_B2JI7QpMtwJWWcSDI_g_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'IomGMc7Zfwxem69eqqvlMjRSj9E_',
			'status': -1,
			'externalId': '',
			'name': 'W1',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_live_transition0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 700,
			'isTransition': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'lYPXz51UnF6v5Sf___8rEtsXDek_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'R0HMkiSy38MascKSmom2ovahStc_',
			'status': -1,
			'externalId': '',
			'name': '2',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_camera0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'xAe0GfwX0GNlLyl_jt82F3twJZ4_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'R0HMkiSy38MascKSmom2ovahStc_',
			'status': -1,
			'externalId': '',
			'name': 'W1',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_live_transition0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 700,
			'isTransition': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'aswCTk5xUuaMHFIzQjpVzVmywJc_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'R0HMkiSy38MascKSmom2ovahStc_',
			'status': -1,
			'externalId': '',
			'name': 'Gjest',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_gjest_mic',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 2,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '3CebXnDhl2CyDgDgPIk08NMx0Fg_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'saTW13T4_wBQQIXXw9J1dRU0XXw_',
			'status': -1,
			'externalId': '',
			'name': 'Det har kostet…||…ta sykkelen fatt.',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_script',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'lCl8dT9AgXLUEb5Feqnm3DEp7X4_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'saTW13T4_wBQQIXXw9J1dRU0XXw_',
			'status': -1,
			'externalId': '',
			'name': '2',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_camera0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'uldb4Qd_m1RAbEr7OKBcKnts7cY_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'saTW13T4_wBQQIXXw9J1dRU0XXw_',
			'status': -1,
			'externalId': '',
			'name': 'RM1',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_cam_bakskjerm',
			'outputLayerId': 'monitor0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'isTransition': false,
			'adlibPreroll': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'gufLM9FHUOkUUD9JDwbRIpPFZ_s_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'status': -1,
			'externalId': '',
			'name': 'SYKKELVEI-II-310818-SL',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_vb',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'isTransition': false,
			'adlibPreroll': 320,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'RaHmn3jz8KEVzDmag94GkH3nt0k_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'status': -1,
			'externalId': '',
			'name': 'Hans Erik Weiby, reporter',
			'trigger': {
				'type': 1,
				'value': '#piece_group_gufLM9FHUOkUUD9JDwbRIpPFZ_s_.start + 4000'
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 5000,
			'isTransition': false,
			'infiniteMode': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '_Lq1Bst4wF_8Rx9_JL7KQY1Ians_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'status': -1,
			'externalId': '',
			'name': 'Eva Høiby',
			'trigger': {
				'type': 1,
				'value': '#piece_group_gufLM9FHUOkUUD9JDwbRIpPFZ_s_.start + 21000'
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 5000,
			'isTransition': false,
			'infiniteMode': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'PzpVFPPKRJBBRwmMGthI3pB8wbI_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'status': -1,
			'externalId': '',
			'name': 'Kirsten Falch',
			'trigger': {
				'type': 1,
				'value': '#piece_group_gufLM9FHUOkUUD9JDwbRIpPFZ_s_.start + 13000'
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 5000,
			'isTransition': false,
			'infiniteMode': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'Xo3ZfArXZ86_KmX1xP5qgwEzIjQ_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'status': -1,
			'externalId': '',
			'name': 'Jørgen Haugland Kristiansen, varaordfører, Kristiansand (Krf)',
			'trigger': {
				'type': 1,
				'value': '#piece_group_gufLM9FHUOkUUD9JDwbRIpPFZ_s_.start + 53000'
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 5000,
			'isTransition': false,
			'infiniteMode': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'DqbGqHJtAgNRdDHDUOv4koqKkoU_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'status': -1,
			'externalId': '',
			'name': 'Dagfinn Fløystad, avdelingsdirektør, Statens Vegvesen',
			'trigger': {
				'type': 1,
				'value': '#piece_group_gufLM9FHUOkUUD9JDwbRIpPFZ_s_.start + 77000'
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 5000,
			'isTransition': false,
			'infiniteMode': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'wlgEFYqhsP422zxlAvd1Us4XbxU_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'status': -1,
			'externalId': '',
			'name': 'Foto/redigering:, Hans Erik Weiby',
			'trigger': {
				'type': 1,
				'value': '#piece_group_gufLM9FHUOkUUD9JDwbRIpPFZ_s_.start + 99000'
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 5000,
			'isTransition': false,
			'infiniteMode': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '8V4_Q1Fkv6cOAnD38ElvpmggseE_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'BNx_pjsUS_NZmV8z_YmAT_C0riU_',
			'status': -1,
			'externalId': '',
			'name': '1',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_camera0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'n5ZNPhA0MukTARym9EuRkbtYHJs_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'BNx_pjsUS_NZmV8z_YmAT_C0riU_',
			'status': -1,
			'externalId': '',
			'name': '||…[Merknad:Ikke slriv her]',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_script',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'M7Yw6rNvbRW8mgwbVWCo0CFpdBI_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'rUiB1GP4V671z_rYY03v1eM_icQ_',
			'status': -1,
			'externalId': '',
			'name': 'Har seilt hele Norskekysten',
			'trigger': {
				'type': 1,
				'value': '#piece_group_YQbP4trhGeFJK7ZItlsIGPql68c_.start + 0'
			},
			'sourceLayerId': 'studio0_graphics_tema',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 2,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'YQbP4trhGeFJK7ZItlsIGPql68c_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'rUiB1GP4V671z_rYY03v1eM_icQ_',
			'status': -1,
			'externalId': '',
			'name': 'PADLERE-300818S-SL',
			'infiniteMode': 1,
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_live_speak0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'extendOnHold': true,
			'adlibPreroll': 320,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '_JL11OWpq_lrCvi2Q4g7iUL5Vfc_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'rUiB1GP4V671z_rYY03v1eM_icQ_',
			'status': -1,
			'externalId': '',
			'name': '22 Sted/Arkiv (00:00=>00:05, Auto/Auto)',
			'trigger': {
				'type': 1,
				'value': '#piece_group_YQbP4trhGeFJK7ZItlsIGPql68c_.start + 0'
			},
			'sourceLayerId': 'studio0_graphics_tag_left',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 3,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'pb_ifdx1e15_vNRBh0RAUYAn62w_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'rUiB1GP4V671z_rYY03v1eM_icQ_',
			'status': -1,
			'externalId': '',
			'name': 'Elin Ellingsvik Vegestøl…||…langs med kajakk.',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_script',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'I6a_WFSUDf1h4o0OerDCKsssTps_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '3_qhlFEIYlESrvZYxbk3ie_5_z0_',
			'status': -1,
			'externalId': '',
			'name': 'PADLERE-300818F-SL',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_vb',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'isTransition': false,
			'adlibPreroll': 320,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '6nUipLU8_mNCn6ir8IJflXnMVnI_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '3_qhlFEIYlESrvZYxbk3ie_5_z0_',
			'status': -1,
			'externalId': '',
			'name': 'W2',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_live_transition0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 3400,
			'isTransition': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'RpXm2CeDPrIwQUzJwYemV9yTMjQ_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '3_qhlFEIYlESrvZYxbk3ie_5_z0_',
			'status': -1,
			'externalId': '',
			'name': 'Elin Ellingsvik Vegestøl',
			'trigger': {
				'type': 1,
				'value': '#piece_group_I6a_WFSUDf1h4o0OerDCKsssTps_.start + 2000'
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 5000,
			'isTransition': false,
			'infiniteMode': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'go8zzKWwwsV83eUAGejtlH0s7QA_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'Q5fb7VHFWQZjgdUQ_AD9QZjrknk_',
			'status': -1,
			'externalId': '',
			'name': '1',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_camera0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'eESgeR3Z_LEIwcH5dVQXKcrD8aw_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'Q5fb7VHFWQZjgdUQ_AD9QZjrknk_',
			'status': -1,
			'externalId': '',
			'name': 'I dag åpner…||…inn- og utland.',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_script',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '5ikRjj4VLdQLsgMXuCySO5nL71U_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'W3bcE_DKgzZwoq17RsaKBn3__yc_',
			'status': -1,
			'externalId': '',
			'name': 'W3',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_live_transition0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 4200,
			'isTransition': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'gmR0lrNSX3uFow3_xzA_LrzjoY0_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'W3bcE_DKgzZwoq17RsaKBn3__yc_',
			'status': -1,
			'externalId': '',
			'name': 'PUNKTFESTIVALE-300818S-SL',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_live_speak0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'extendOnHold': true,
			'adlibPreroll': 320,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '6_uZjfDAUUzW0v_3m16YLC5sYT4_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'W3bcE_DKgzZwoq17RsaKBn3__yc_',
			'status': -1,
			'externalId': '',
			'name': 'Kristiansand',
			'trigger': {
				'type': 1,
				'value': '#piece_group_gmR0lrNSX3uFow3_xzA_LrzjoY0_.start + 0'
			},
			'sourceLayerId': 'studio0_graphics_tag_left',
			'outputLayerId': 'pgm0',
			'expectedDuration': 5000,
			'isTransition': false,
			'infiniteMode': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'lEWIkpUtGIg_75H1xL06rFwxd4g_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'W3bcE_DKgzZwoq17RsaKBn3__yc_',
			'status': -1,
			'externalId': '',
			'name': '10 Tema|Vanlig (00:00, Auto/OnNext)',
			'trigger': {
				'type': 1,
				'value': '#piece_group_gmR0lrNSX3uFow3_xzA_LrzjoY0_.start + 0'
			},
			'sourceLayerId': 'studio0_graphics_tema',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 2,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'Gor46LiycWIRuL1Ky7ckEfOd3_0_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
			'status': -1,
			'externalId': '',
			'name': 'K1 RM1',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_split0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'adlibPreroll': 80,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '9MAvR7_U8rnEorrfh10ttwgSsYs_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
			'status': -1,
			'externalId': '',
			'name': '10 Tema|Vanlig (00:00, Auto/OnNext)',
			'trigger': {
				'type': 1,
				'value': '#piece_group_Gor46LiycWIRuL1Ky7ckEfOd3_0_.start + 0'
			},
			'sourceLayerId': 'studio0_graphics_tema',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 2,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'CKOR8_Z8g1_ijNvVpONMv2szFc8_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
			'status': -1,
			'externalId': '',
			'name': 'Kristiansand',
			'trigger': {
				'type': 1,
				'value': '#piece_group_Gor46LiycWIRuL1Ky7ckEfOd3_0_.start + 0'
			},
			'sourceLayerId': 'studio0_graphics_tag_right',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 2,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'jUD0sGg6BYA29Vj1NSFnDLcE4ho_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
			'status': -1,
			'externalId': '',
			'name': 'Og, kollega Janne…||…med Punkt festivalen?',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_script',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'Bshu4FS7QJtkUXrnDB3sqsQW1eA_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'kPKjHD_z3qXD35LqPOD314lOSPo_',
			'status': -1,
			'externalId': '',
			'name': 'RM 1',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_remote0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'XWSv4gi2n57TRctyyDnbP5rIy7Q_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'MTwVEbe90uguNcecrum5tqVLzWg_',
			'status': -1,
			'externalId': '',
			'name': '||…[Merknad:Ikke slriv her]',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_script',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'DUI9uL9pVSrHpzV6tGVnSxwvU_I_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'MTwVEbe90uguNcecrum5tqVLzWg_',
			'status': -1,
			'externalId': '',
			'name': '2',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_camera0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '5pOOv5O2vNu5w0_9rTkeabxkIGY_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nArzKAkxPONWUVchEVB4o1Q4VsE_',
			'status': -1,
			'externalId': '',
			'name': '||…]',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_script',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'YW57oEWHtHhYH_Iy0FdM8H1Piy4_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nArzKAkxPONWUVchEVB4o1Q4VsE_',
			'status': -1,
			'externalId': '',
			'name': '10 Tema|Vanlig (00:00, Auto/OnNext)',
			'trigger': {
				'type': 1,
				'value': '#piece_group_Nlk8edC6GmINQDYncr3x8ItEG6k_.start + 0'
			},
			'sourceLayerId': 'studio0_graphics_tema',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 2,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'Nlk8edC6GmINQDYncr3x8ItEG6k_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nArzKAkxPONWUVchEVB4o1Q4VsE_',
			'status': -1,
			'externalId': '',
			'name': 'blah blah blah',
			'infiniteMode': 1,
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_live_speak0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'extendOnHold': true,
			'adlibPreroll': 320,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'pgBnIUH5lgB0mjHzSxB501e5tVQ_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'UoSeVe3h1b67aSun_UMUSSz9NZw_',
			'status': -1,
			'externalId': '',
			'name': 'blah blah blah +3dB',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_vb',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'isTransition': false,
			'adlibPreroll': 320,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'djDgFpa8axSxWAVx5bdTTU_2jaE_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'UoSeVe3h1b67aSun_UMUSSz9NZw_',
			'status': -1,
			'externalId': '',
			'name': '||…]',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_script',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'ppI8aRqEYJmsXJ7nIfOw5FlB_eI_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'cq9VY7XbnFhpZGSr0q5tfvOx5gs_',
			'status': -1,
			'externalId': '',
			'name': '1',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_camera0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'Y6myM3Nmj3GTzzoCZqsLHXD_xgo_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'gRQFPOgXaV7r_WqgNCPqVcAvsGc_',
			'status': -1,
			'externalId': '',
			'name': 'Utsikt fra Vogts villa',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_graphics_fullskjerm',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'T65tG_AIK92M_zzWsXtNO6kJ3Vs_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'zZPFW5kV_Cy1w_NeZX7nvAGxFSQ_',
			'status': -1,
			'externalId': '',
			'name': '1',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_camera0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'BwyjnTvB6P81qUJdjBbN50QWKdg_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'zZPFW5kV_Cy1w_NeZX7nvAGxFSQ_',
			'status': -1,
			'externalId': '',
			'name': '||…[Merknad:Ikke slriv her]',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_script',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'JPVYfSW2W_cPubsDdEhYO1pMJnU_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '1WWrqgLIvlxNE4ciwOSL2Qn2yCI_',
			'status': -1,
			'externalId': '',
			'name': 'Utsikt fra Vogts villa',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_graphics_fullskjerm',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'qxcOyLAuolGfC_ceVpd7d_iBICI_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'jh3nz3Le_21YJMCMTZ_uwp6smDY_',
			'status': -1,
			'externalId': '',
			'name': 'VERET-SØNDAG-310818S-SL',
			'infiniteMode': 1,
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_live_speak0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'extendOnHold': true,
			'adlibPreroll': 320,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'y55T_icR56pngbhkQ9umZZGFDko_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'jh3nz3Le_21YJMCMTZ_uwp6smDY_',
			'status': -1,
			'externalId': '',
			'name': 'M12',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_live_transition0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 800,
			'isTransition': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'SeezwJS6BhMS_xl3Ka8sS0Np2Fo_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'jh3nz3Le_21YJMCMTZ_uwp6smDY_',
			'status': -1,
			'externalId': '',
			'name': 'Værdata er levert av Meteorologisk institutt',
			'trigger': {
				'type': 1,
				'value': '#piece_group_qxcOyLAuolGfC_ceVpd7d_iBICI_.start + 0'
			},
			'sourceLayerId': 'studio0_graphics_ticker',
			'outputLayerId': 'pgm0',
			'expectedDuration': 3000,
			'isTransition': false,
			'infiniteMode': 0,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'ml0O0D0CjZN2M3rvuc6qjHw0V5s_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'gtWWWXdaRUM3KfiXAWoRUN879a8_',
			'status': -1,
			'externalId': '',
			'name': 'nrk.no/sorlandet',
			'trigger': {
				'type': 1,
				'value': '#piece_group_iYV2nwyyU_lvhN0bDcHT_ee_pdQ_.start + 0'
			},
			'sourceLayerId': 'studio0_graphics_ticker',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'isTransition': false,
			'infiniteMode': 2,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'iYV2nwyyU_lvhN0bDcHT_ee_pdQ_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'gtWWWXdaRUM3KfiXAWoRUN879a8_',
			'status': -1,
			'externalId': '',
			'name': '1',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_camera0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'iaYPx1LzG1EtFUudadsWpwBE3V4_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'externalId': '',
			'name': '4',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_camera0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'infiniteMode': 1,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'Bhs7uLGjZaMvgRqqJJ4W3EXmKIg_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'externalId': '',
			'name': 'M12',
			'trigger': {
				'type': 0,
				'value': 0
			},
			'sourceLayerId': 'studio0_live_transition0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 480,
			'isTransition': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'chRzaZ6XNte55BCWmSQYNF7iAYQ_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'externalId': '',
			'name': '',
			'trigger': {
				'type': 1,
				'value': 86400000
			},
			'sourceLayerId': 'studio0_hyperdeck0',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'virtual': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '0LZzJKpFV0rSVOoNTJ6RzTtJBv8_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'externalId': '',
			'name': '',
			'trigger': {
				'type': 1,
				'value': 86400000
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'virtual': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '2tG6c7hz08HPL2a3Gn8HsTQLPh8_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'externalId': '',
			'name': '',
			'trigger': {
				'type': 1,
				'value': 86400000
			},
			'sourceLayerId': 'studio0_graphics_super',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'virtual': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'Mm2xC7FUl0thKiGZjRundownH0VIS4A8_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'externalId': '',
			'name': '',
			'trigger': {
				'type': 1,
				'value': 86400000
			},
			'sourceLayerId': 'studio0_graphics_tag_left',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'virtual': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'tSvDwp7FidC9_TdlwWMqdn8mCgg_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'externalId': '',
			'name': '',
			'trigger': {
				'type': 1,
				'value': 86400000
			},
			'sourceLayerId': 'studio0_graphics_ticker',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'virtual': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'enm8Z_kdCy4ajcxedBqU2QX8dME_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'externalId': '',
			'name': '',
			'trigger': {
				'type': 1,
				'value': 86400000
			},
			'sourceLayerId': 'studio0_graphics_tag_right',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'virtual': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '8Z5vFNJw64jzuXi3xTIprm4mqSk_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'externalId': '',
			'name': '',
			'trigger': {
				'type': 1,
				'value': 86400000
			},
			'sourceLayerId': 'studio0_graphics_logo',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'virtual': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': 'AYvMhzos6GuMua0Mf__HsfQfTm4_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'externalId': '',
			'name': '',
			'trigger': {
				'type': 1,
				'value': 86400000
			},
			'sourceLayerId': 'studio0_graphics_klokke',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'virtual': true,
			'content': {
				'timelineObjects': []
			}
		},
		{
			'_id': '9hZN8iZ0ctzeuWE24VAmqMtz2qA_',
			'rundownId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'externalId': '',
			'name': '',
			'trigger': {
				'type': 1,
				'value': 86400000
			},
			'sourceLayerId': 'studio0_graphics_tema',
			'outputLayerId': 'pgm0',
			'expectedDuration': 0,
			'virtual': true,
			'content': {
				'timelineObjects': []
			}
		}
	]
}
