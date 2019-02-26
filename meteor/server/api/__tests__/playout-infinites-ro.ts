import { DBSegment } from '../../../lib/collections/Segments'
import { RunningOrder, DBRunningOrder } from '../../../lib/collections/RunningOrders'
import { DBSegmentLine } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem } from '../../../lib/collections/SegmentLineItems'
import { literal } from '../../../lib/lib'

export interface MockRO {
	runningOrder: RunningOrder,
	segments: Array<DBSegment>,
	segmentLines: Array<DBSegmentLine>,
	segmentLineItems: Array<SegmentLineItem>,
}

export const testRO1: MockRO = {
	runningOrder: new RunningOrder(literal<DBRunningOrder>({
		_id: 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
		mosId: '',
		studioInstallationId: '',
		showStyleBaseId: '',
		showStyleVariantId: '',
		mosDeviceId: '',
		name: 'Infinite Mock 1',
		created: 0,
		modified: 0,
		previousSegmentLineId: null,
		currentSegmentLineId: null,
		nextSegmentLineId: null,
		dataSource: ''
	})),
	segments: [
		{
			'_id': '6kb7AuZaDD5Ao_CGeOoYNgjk4uU_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 1,
			'mosId': '',
			'name': 'BYVEKST AVTALE'
		},
		{
			'_id': 'tIvBNK46jZgZ6RbB8G7Q0RwttIY_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 0,
			'mosId': '',
			'name': 'VIGNETT'
		},
		{
			'_id': 'sjZOWRQEV4YMFCCEVo24IG8yHzg_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 2,
			'mosId': '',
			'name': 'GJEST'
		},
		{
			'_id': '5gnIW3D21_T_OBA8I9VVT_L3DIE_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 3,
			'mosId': '',
			'name': 'SYKKEL VEI'
		},
		{
			'_id': 'PZ7S4nZrGfQYcjN6G21kkAn9PxY_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 4,
			'mosId': '',
			'name': 'PADLERE'
		},
		{
			'_id': 'KfgYowajVA_cXg8UzQE3MRrdWOM_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 6,
			'mosId': '',
			'name': 'KOMMER 2055'
		},
		{
			'_id': 'MXqlF3LNzJeAHkkLozXc5jNJwEE_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 5,
			'mosId': '',
			'name': 'DIREKTE PUNKT FESTIVAL'
		},
		{
			'_id': '18J8ymz6_XVRPRyBkqEh4a_HT_k_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 7,
			'mosId': '',
			'name': 'SEERBILDE'
		},
		{
			'_id': 'mMTQmzfQViEj2LHGSOdl1NvdWFQ_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 8,
			'mosId': '',
			'name': 'VÆRET'
		},
		{
			'_id': 'sC4hfTUMutgKQnG_QrH0nBjbP_0_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'_rank': 9,
			'mosId': '',
			'name': 'TAKK FOR IDAG'
		}
	]
	,
	segmentLines: [
		{
			'_id': 'GuR5i3ccRRKVhdOtOmgzP8Coeqs_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'tIvBNK46jZgZ6RbB8G7Q0RwttIY_',
			'_rank': 0,
			'mosId': '',
			'slug': 'VIGNETT;Vignett',
			'typeVariant': 'vignett',
			'expectedDuration': 13240,
			'subTypeVariant': ''
		},
		{
			'_id': 'bzwmGuXuSSg_dRHhlNDFNNl1_Js_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'tIvBNK46jZgZ6RbB8G7Q0RwttIY_',
			'_rank': 1,
			'mosId': '',
			'slug': 'VIGNETT;Head 1',
			'typeVariant': 'head',
			'expectedDuration': 8880,
			'subTypeVariant': ''
		},
		{
			'_id': 'qGi_A8A0NtZoSgNnYZVNI_Vb700_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'tIvBNK46jZgZ6RbB8G7Q0RwttIY_',
			'_rank': 2,
			'mosId': '',
			'slug': 'VIGNETT;Head 2',
			'typeVariant': 'head',
			'expectedDuration': 19960,
			'subTypeVariant': ''
		},
		{
			'_id': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'tIvBNK46jZgZ6RbB8G7Q0RwttIY_',
			'_rank': 3,
			'mosId': '',
			'slug': 'VIGNETT;Velkommen med super',
			'typeVariant': 'kam',
			'expectedDuration': 4880,
			'subTypeVariant': ''
		},
		{
			'_id': 'kjW9GfMhvvh_CdSnBrnQmd9WBOk_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': '6kb7AuZaDD5Ao_CGeOoYNgjk4uU_',
			'_rank': 4,
			'mosId': '',
			'slug': 'BYVEKST AVTALE;intro -',
			'typeVariant': 'kam',
			'expectedDuration': 14000,
			'subTypeVariant': ''
		},
		{
			'_id': '2yKRioTfVGnRztaYBn3uW013U7M_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': '6kb7AuZaDD5Ao_CGeOoYNgjk4uU_',
			'_rank': 5,
			'mosId': '',
			'slug': 'BYVEKST AVTALE;BYVEKST-AVTALE-300818-SL',
			'typeVariant': 'full',
			'expectedDuration': 8560,
			'subTypeVariant': ''
		},
		{
			'_id': 'IomGMc7Zfwxem69eqqvlMjRSj9E_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'sjZOWRQEV4YMFCCEVo24IG8yHzg_',
			'_rank': 6,
			'mosId': '',
			'slug': 'GJEST;Intro',
			'typeVariant': 'kam',
			'expectedDuration': 4880,
			'subTypeVariant': ''
		},
		{
			'_id': 'saTW13T4_wBQQIXXw9J1dRU0XXw_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': '5gnIW3D21_T_OBA8I9VVT_L3DIE_',
			'_rank': 8,
			'mosId': '',
			'slug': 'SYKKEL VEI;intro -',
			'typeVariant': 'kam',
			'expectedDuration': 13000,
			'subTypeVariant': ''
		},
		{
			'_id': 'R0HMkiSy38MascKSmom2ovahStc_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'sjZOWRQEV4YMFCCEVo24IG8yHzg_',
			'_rank': 7,
			'mosId': '',
			'slug': 'GJEST;GJEST-',
			'typeVariant': 'kam',
			'expectedDuration': 29880,
			'subTypeVariant': ''
		},
		{
			'_id': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': '5gnIW3D21_T_OBA8I9VVT_L3DIE_',
			'_rank': 9,
			'mosId': '',
			'slug': 'SYKKEL VEI;SYKKEL-VEI-310818-SL',
			'typeVariant': 'full',
			'expectedDuration': 110920,
			'subTypeVariant': ''
		},
		{
			'_id': 'BNx_pjsUS_NZmV8z_YmAT_C0riU_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'PZ7S4nZrGfQYcjN6G21kkAn9PxY_',
			'_rank': 10,
			'mosId': '',
			'slug': 'PADLERE;Kamera - ikke skriv her',
			'typeVariant': 'kam',
			'expectedDuration': 3000,
			'subTypeVariant': ''
		},
		{
			'_id': 'rUiB1GP4V671z_rYY03v1eM_icQ_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'PZ7S4nZrGfQYcjN6G21kkAn9PxY_',
			'_rank': 11,
			'mosId': '',
			'slug': 'PADLERE;PADLERE-300818S-SL',
			'typeVariant': 'stk',
			'expectedDuration': 21000,
			'subTypeVariant': ''
		},
		{
			'_id': '3_qhlFEIYlESrvZYxbk3ie_5_z0_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'PZ7S4nZrGfQYcjN6G21kkAn9PxY_',
			'_rank': 12,
			'mosId': '',
			'slug': 'PADLERE;PADLERE-300818F-SL',
			'typeVariant': 'full',
			'expectedDuration': 9240,
			'subTypeVariant': ''
		},
		{
			'_id': 'Q5fb7VHFWQZjgdUQ_AD9QZjrknk_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'MXqlF3LNzJeAHkkLozXc5jNJwEE_',
			'_rank': 13,
			'mosId': '',
			'slug': 'DIREKTE PUNKT FESTIVAL;intro -',
			'typeVariant': 'kam',
			'expectedDuration': 9000,
			'subTypeVariant': ''
		},
		{
			'_id': 'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'MXqlF3LNzJeAHkkLozXc5jNJwEE_',
			'_rank': 15,
			'mosId': '',
			'slug': 'DIREKTE PUNKT FESTIVAL;Split',
			'typeVariant': 'split',
			'expectedDuration': 4000,
			'subTypeVariant': '',
			'stoppedPlayback': true
		},
		{
			'_id': 'W3bcE_DKgzZwoq17RsaKBn3__yc_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'MXqlF3LNzJeAHkkLozXc5jNJwEE_',
			'_rank': 14,
			'mosId': '',
			'slug': 'DIREKTE PUNKT FESTIVAL;PUNKTFESTIVALE-300818S-SL',
			'typeVariant': 'stk',
			'expectedDuration': 11800,
			'subTypeVariant': ''
		},
		{
			'_id': 'kPKjHD_z3qXD35LqPOD314lOSPo_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'MXqlF3LNzJeAHkkLozXc5jNJwEE_',
			'_rank': 16,
			'mosId': '',
			'slug': 'DIREKTE PUNKT FESTIVAL;Live',
			'typeVariant': 'dir',
			'expectedDuration': 0,
			'subTypeVariant': ''
		},
		{
			'_id': 'MTwVEbe90uguNcecrum5tqVLzWg_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'KfgYowajVA_cXg8UzQE3MRrdWOM_',
			'_rank': 17,
			'mosId': '',
			'slug': 'KOMMER 2055;Kamera - ikke skriv her',
			'typeVariant': 'kam',
			'expectedDuration': 0,
			'subTypeVariant': ''
		},
		{
			'_id': 'nArzKAkxPONWUVchEVB4o1Q4VsE_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'KfgYowajVA_cXg8UzQE3MRrdWOM_',
			'_rank': 18,
			'mosId': '',
			'slug': 'KOMMER 2055;STK',
			'typeVariant': 'stk',
			'expectedDuration': 15000,
			'subTypeVariant': ''
		},
		{
			'_id': 'UoSeVe3h1b67aSun_UMUSSz9NZw_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'KfgYowajVA_cXg8UzQE3MRrdWOM_',
			'_rank': 19,
			'mosId': '',
			'slug': 'KOMMER 2055;SYNK',
			'typeVariant': 'full',
			'expectedDuration': 15000,
			'subTypeVariant': ''
		},
		{
			'_id': 'cq9VY7XbnFhpZGSr0q5tfvOx5gs_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': '18J8ymz6_XVRPRyBkqEh4a_HT_k_',
			'_rank': 20,
			'mosId': '',
			'slug': 'SEERBILDE;Kamera - ikke skriv her',
			'typeVariant': 'kam',
			'expectedDuration': 3000,
			'subTypeVariant': ''
		},
		{
			'_id': 'gRQFPOgXaV7r_WqgNCPqVcAvsGc_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': '18J8ymz6_XVRPRyBkqEh4a_HT_k_',
			'_rank': 21,
			'mosId': '',
			'slug': 'SEERBILDE;SEERBILDE',
			'typeVariant': 'grafikk',
			'expectedDuration': 15000,
			'subTypeVariant': ''
		},
		{
			'_id': 'zZPFW5kV_Cy1w_NeZX7nvAGxFSQ_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'mMTQmzfQViEj2LHGSOdl1NvdWFQ_',
			'_rank': 22,
			'mosId': '',
			'slug': 'VÆRET;Kamera - ikke skriv her',
			'typeVariant': 'kam',
			'expectedDuration': 0,
			'subTypeVariant': ''
		},
		{
			'_id': '1WWrqgLIvlxNE4ciwOSL2Qn2yCI_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'mMTQmzfQViEj2LHGSOdl1NvdWFQ_',
			'_rank': 23,
			'mosId': '',
			'slug': 'VÆRET;VERET-LØRDAG-310818S-SL',
			'typeVariant': 'grafikk',
			'expectedDuration': 15000,
			'subTypeVariant': ''
		},
		{
			'_id': 'jh3nz3Le_21YJMCMTZ_uwp6smDY_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'mMTQmzfQViEj2LHGSOdl1NvdWFQ_',
			'_rank': 24,
			'mosId': '',
			'slug': 'VÆRET;VERET-SØNDAG-310818S-SL',
			'typeVariant': 'stk',
			'expectedDuration': 0,
			'subTypeVariant': ''
		},
		{
			'_id': 'gtWWWXdaRUM3KfiXAWoRUN879a8_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'sC4hfTUMutgKQnG_QrH0nBjbP_0_',
			'_rank': 25,
			'mosId': '',
			'slug': 'TAKK FOR IDAG;tekst - takk for nå.',
			'typeVariant': 'kam',
			'expectedDuration': 5000,
			'subTypeVariant': ''
		},
		{
			'_id': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentId': 'sC4hfTUMutgKQnG_QrH0nBjbP_0_',
			'_rank': 26,
			'mosId': '',
			'slug': 'TAKK FOR IDAG;SLUTTKREDITT LUKKING',
			'typeVariant': 'kam',
			'expectedDuration': 13540,
			'subTypeVariant': ''
		}
	],
	segmentLineItems: [
		{
			'_id': 'NowSlQNWBLo1CnTRDxU9gxupE38_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'GuR5i3ccRRKVhdOtOmgzP8Coeqs_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'GuR5i3ccRRKVhdOtOmgzP8Coeqs_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'GuR5i3ccRRKVhdOtOmgzP8Coeqs_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'bzwmGuXuSSg_dRHhlNDFNNl1_Js_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'bzwmGuXuSSg_dRHhlNDFNNl1_Js_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'bzwmGuXuSSg_dRHhlNDFNNl1_Js_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'bzwmGuXuSSg_dRHhlNDFNNl1_Js_',
			'status': -1,
			'mosId': '',
			'name': 'Frykter tap av millioner',
			'trigger': {
				'type': 1,
				'value': '#sli_group_NOm1Mz2GMYo_jfG3kMHNvkH91BI_.start + 0'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'qGi_A8A0NtZoSgNnYZVNI_Vb700_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'qGi_A8A0NtZoSgNnYZVNI_Vb700_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'qGi_A8A0NtZoSgNnYZVNI_Vb700_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'qGi_A8A0NtZoSgNnYZVNI_Vb700_',
			'status': -1,
			'mosId': '',
			'name': 'Ny sykkelvei til 80 millioner',
			'trigger': {
				'type': 1,
				'value': '#sli_group_nMkRoyy19ZwUn90QY18xhnQ1ouM_.start + 0'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'mosId': '',
			'name': '50 Logo (00:00, Auto/Manual)',
			'trigger': {
				'type': 1,
				'value': '#sli_group___RRnX1FKXGonKEcFl06W_SvthI_.start + 0'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'mosId': '',
			'name': '51 Klokke (00:00, Auto/Manual)',
			'trigger': {
				'type': 1,
				'value': '#sli_group___RRnX1FKXGonKEcFl06W_SvthI_.start + 0'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'mosId': '',
			'name': 'Lars Eie',
			'trigger': {
				'type': 1,
				'value': '#sli_group___RRnX1FKXGonKEcFl06W_SvthI_.start + 1000'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'mosId': '',
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
			},
			'fromPostProcess': true
		},
		{
			'_id': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ__bed_fade',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
			'status': -1,
			'mosId': '',
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
			},
			'fromPostProcess': true
		},
		{
			'_id': '6a0SIN5JtjSSL_XofAJoRCoaMPA_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'kjW9GfMhvvh_CdSnBrnQmd9WBOk_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'kjW9GfMhvvh_CdSnBrnQmd9WBOk_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '2yKRioTfVGnRztaYBn3uW013U7M_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '2yKRioTfVGnRztaYBn3uW013U7M_',
			'status': -1,
			'mosId': '',
			'name': 'Anne Wirsching, reporter',
			'trigger': {
				'type': 1,
				'value': '#sli_group_Z3DAd2PGUvvF_M1Ih25F_F5MVjY_.start + 2000'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '2yKRioTfVGnRztaYBn3uW013U7M_',
			'status': -1,
			'mosId': '',
			'name': 'Harald Furre, ordfører Kristiansand (H)',
			'trigger': {
				'type': 1,
				'value': '#sli_group_Z3DAd2PGUvvF_M1Ih25F_F5MVjY_.start + 18000'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '2yKRioTfVGnRztaYBn3uW013U7M_',
			'status': -1,
			'mosId': '',
			'name': 'Foto/redigering:, Anne Wirsching',
			'trigger': {
				'type': 1,
				'value': '#sli_group_Z3DAd2PGUvvF_M1Ih25F_F5MVjY_.start + 103000'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '2yKRioTfVGnRztaYBn3uW013U7M_',
			'status': -1,
			'mosId': '',
			'name': 'Mette Gundersen, gruppeleder, Arbeiderpartiet, Kristiansand',
			'trigger': {
				'type': 1,
				'value': '#sli_group_Z3DAd2PGUvvF_M1Ih25F_F5MVjY_.start + 34000'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'IomGMc7Zfwxem69eqqvlMjRSj9E_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'IomGMc7Zfwxem69eqqvlMjRSj9E_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'R0HMkiSy38MascKSmom2ovahStc_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'R0HMkiSy38MascKSmom2ovahStc_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'R0HMkiSy38MascKSmom2ovahStc_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'saTW13T4_wBQQIXXw9J1dRU0XXw_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'saTW13T4_wBQQIXXw9J1dRU0XXw_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'saTW13T4_wBQQIXXw9J1dRU0XXw_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'status': -1,
			'mosId': '',
			'name': 'Hans Erik Weiby, reporter',
			'trigger': {
				'type': 1,
				'value': '#sli_group_gufLM9FHUOkUUD9JDwbRIpPFZ_s_.start + 4000'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'status': -1,
			'mosId': '',
			'name': 'Eva Høiby',
			'trigger': {
				'type': 1,
				'value': '#sli_group_gufLM9FHUOkUUD9JDwbRIpPFZ_s_.start + 21000'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'status': -1,
			'mosId': '',
			'name': 'Kirsten Falch',
			'trigger': {
				'type': 1,
				'value': '#sli_group_gufLM9FHUOkUUD9JDwbRIpPFZ_s_.start + 13000'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'status': -1,
			'mosId': '',
			'name': 'Jørgen Haugland Kristiansen, varaordfører, Kristiansand (Krf)',
			'trigger': {
				'type': 1,
				'value': '#sli_group_gufLM9FHUOkUUD9JDwbRIpPFZ_s_.start + 53000'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'status': -1,
			'mosId': '',
			'name': 'Dagfinn Fløystad, avdelingsdirektør, Statens Vegvesen',
			'trigger': {
				'type': 1,
				'value': '#sli_group_gufLM9FHUOkUUD9JDwbRIpPFZ_s_.start + 77000'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
			'status': -1,
			'mosId': '',
			'name': 'Foto/redigering:, Hans Erik Weiby',
			'trigger': {
				'type': 1,
				'value': '#sli_group_gufLM9FHUOkUUD9JDwbRIpPFZ_s_.start + 99000'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'BNx_pjsUS_NZmV8z_YmAT_C0riU_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'BNx_pjsUS_NZmV8z_YmAT_C0riU_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'rUiB1GP4V671z_rYY03v1eM_icQ_',
			'status': -1,
			'mosId': '',
			'name': 'Har seilt hele Norskekysten',
			'trigger': {
				'type': 1,
				'value': '#sli_group_YQbP4trhGeFJK7ZItlsIGPql68c_.start + 0'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'rUiB1GP4V671z_rYY03v1eM_icQ_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'rUiB1GP4V671z_rYY03v1eM_icQ_',
			'status': -1,
			'mosId': '',
			'name': '22 Sted/Arkiv (00:00=>00:05, Auto/Auto)',
			'trigger': {
				'type': 1,
				'value': '#sli_group_YQbP4trhGeFJK7ZItlsIGPql68c_.start + 0'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'rUiB1GP4V671z_rYY03v1eM_icQ_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '3_qhlFEIYlESrvZYxbk3ie_5_z0_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '3_qhlFEIYlESrvZYxbk3ie_5_z0_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '3_qhlFEIYlESrvZYxbk3ie_5_z0_',
			'status': -1,
			'mosId': '',
			'name': 'Elin Ellingsvik Vegestøl',
			'trigger': {
				'type': 1,
				'value': '#sli_group_I6a_WFSUDf1h4o0OerDCKsssTps_.start + 2000'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'Q5fb7VHFWQZjgdUQ_AD9QZjrknk_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'Q5fb7VHFWQZjgdUQ_AD9QZjrknk_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'W3bcE_DKgzZwoq17RsaKBn3__yc_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'W3bcE_DKgzZwoq17RsaKBn3__yc_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'W3bcE_DKgzZwoq17RsaKBn3__yc_',
			'status': -1,
			'mosId': '',
			'name': 'Kristiansand',
			'trigger': {
				'type': 1,
				'value': '#sli_group_gmR0lrNSX3uFow3_xzA_LrzjoY0_.start + 0'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'W3bcE_DKgzZwoq17RsaKBn3__yc_',
			'status': -1,
			'mosId': '',
			'name': '10 Tema|Vanlig (00:00, Auto/OnNext)',
			'trigger': {
				'type': 1,
				'value': '#sli_group_gmR0lrNSX3uFow3_xzA_LrzjoY0_.start + 0'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
			'status': -1,
			'mosId': '',
			'name': '10 Tema|Vanlig (00:00, Auto/OnNext)',
			'trigger': {
				'type': 1,
				'value': '#sli_group_Gor46LiycWIRuL1Ky7ckEfOd3_0_.start + 0'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
			'status': -1,
			'mosId': '',
			'name': 'Kristiansand',
			'trigger': {
				'type': 1,
				'value': '#sli_group_Gor46LiycWIRuL1Ky7ckEfOd3_0_.start + 0'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'kPKjHD_z3qXD35LqPOD314lOSPo_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'MTwVEbe90uguNcecrum5tqVLzWg_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'MTwVEbe90uguNcecrum5tqVLzWg_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nArzKAkxPONWUVchEVB4o1Q4VsE_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nArzKAkxPONWUVchEVB4o1Q4VsE_',
			'status': -1,
			'mosId': '',
			'name': '10 Tema|Vanlig (00:00, Auto/OnNext)',
			'trigger': {
				'type': 1,
				'value': '#sli_group_Nlk8edC6GmINQDYncr3x8ItEG6k_.start + 0'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'nArzKAkxPONWUVchEVB4o1Q4VsE_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'UoSeVe3h1b67aSun_UMUSSz9NZw_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'UoSeVe3h1b67aSun_UMUSSz9NZw_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'cq9VY7XbnFhpZGSr0q5tfvOx5gs_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'gRQFPOgXaV7r_WqgNCPqVcAvsGc_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'zZPFW5kV_Cy1w_NeZX7nvAGxFSQ_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'zZPFW5kV_Cy1w_NeZX7nvAGxFSQ_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': '1WWrqgLIvlxNE4ciwOSL2Qn2yCI_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'jh3nz3Le_21YJMCMTZ_uwp6smDY_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'jh3nz3Le_21YJMCMTZ_uwp6smDY_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'jh3nz3Le_21YJMCMTZ_uwp6smDY_',
			'status': -1,
			'mosId': '',
			'name': 'Værdata er levert av Meteorologisk institutt',
			'trigger': {
				'type': 1,
				'value': '#sli_group_qxcOyLAuolGfC_ceVpd7d_iBICI_.start + 0'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'gtWWWXdaRUM3KfiXAWoRUN879a8_',
			'status': -1,
			'mosId': '',
			'name': 'nrk.no/sorlandet',
			'trigger': {
				'type': 1,
				'value': '#sli_group_iYV2nwyyU_lvhN0bDcHT_ee_pdQ_.start + 0'
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'gtWWWXdaRUM3KfiXAWoRUN879a8_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'mosId': '',
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
			'_id': 'Mm2xC7FUl0thKiGZjRoH0VIS4A8_',
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'mosId': '',
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
			'runningOrderId': 'XnMVCR7jrKuaTF_cFN3brXvZZCw_',
			'segmentLineId': 'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'status': -1,
			'mosId': '',
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
