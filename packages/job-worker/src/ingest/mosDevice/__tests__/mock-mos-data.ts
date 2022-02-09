import { MOS } from '@sofie-automation/corelib'
import { literal } from '@sofie-automation/corelib/dist/lib'

export const mockRO = {
	roCreate: (): MOS.IMOSRunningOrder =>
		literal<MOS.IMOSRunningOrder>({
			ID: new MOS.MosString128('SLENPS01;P_NDSL\\W;68E40DE6-2D08-487D-aaaaa'),
			Slug: new MOS.MosString128('All effect1 into clip combinations'),
			EditorialStart: new MOS.MosTime('2018-11-07T07:00:00,000Z'),
			EditorialDuration: new MOS.MosDuration('0:9:0'),
			MosExternalMetaData: [
				{
					MosSchema: 'http://SLENPS01:10505/schema/enpsro.dtd',
					MosPayload: {
						AllowExternalMod: 1,
						EndTime: '2018-09-07T07:09:00',
						MOSroBlock: 'VIZ.DKOA.MOS;VIZ.NPRO.MOS;VIZ.TPRO.MOS',
						MOSROStatus: 'PLAY',
						MOSROStatusMOS: 'MOSART1.NDSL.MOS',
						MOSROStatusTime: '2018-05-14T11:21:13',
						MOSroStorySend: 'DPE01.NRK.MOS;OMNIBUS.NDSL.STORYMOS;SOFIE1.DKSL.MOS',
						ProgramName: 'DKSL TV 1850',
						RundownDuration: '09:00',
						StartTime: '2018-10-07T07:00:00',
						AnsvRed: 'DKSL',
						AutoArchiveClips: 1,
						Clipnames: 'Klipp 1;\\Klipp 2;\\Klipp 3;\\Klipp 4;',
						Kanal: 'NRK1',
						ProdNr: 'DKSL99090618',
						Regionalsend: 'SL',
						LocalStartTime: '2018-10-07T07:00:00',
						ENPSItemType: 2,
						roLayout:
							'PageNum_450|RowStatus_150|Slug_1920|SegStatus_210|Segment_2595|mosartType_1110|mosartVariant_1290|mosartTransition_825|ip1_460|ip2_535|MOSObjSlugs_8295|Estimated_555|Actual_570|MOSItemDurations_630|Float_600|Tekniske-opplysninger_1875|FrontTime_1005|ElapsedTime_1000',
					},
					MosScope: MOS.IMOSScope.PLAYLIST,
				},
			],
			Stories: [
				{
					ID: new MOS.MosString128('ro1;s1;p1'),
					Slug: new MOS.MosString128('SEGMENT1;PART1'),
					Items: [],
				},
				{
					ID: new MOS.MosString128('ro1;s1;p2'),
					Slug: new MOS.MosString128('SEGMENT1;PART2'),
					Items: [],
				},
				{
					ID: new MOS.MosString128('ro1;s1;p3'),
					Slug: new MOS.MosString128('SEGMENT1;PART3'),
					Items: [],
				},
				{
					ID: new MOS.MosString128('ro1;s2;p1'),
					Slug: new MOS.MosString128('SEGMENT2;PART1'),
					Items: [],
				},
				{
					ID: new MOS.MosString128('ro1;s2;p2'),
					Slug: new MOS.MosString128('SEGMENT2;PART2'),
					Items: [],
				},
				{
					ID: new MOS.MosString128('ro1;s3;p1'),
					Slug: new MOS.MosString128('SEGMENT3;PART1'),
					Items: [],
				},
				{
					ID: new MOS.MosString128('ro1;s3;p2'),
					Slug: new MOS.MosString128('SEGMENT3;PART2'),
					Items: [],
				},
				{
					ID: new MOS.MosString128('ro1;s4;p1'),
					Slug: new MOS.MosString128('SEGMENT2;PART3'), // To check that segment parsing works right when split
					Items: [],
				},
			],
		}),
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	segmentIdMap: () => [
		{
			parts: ['ro1;s1;p1', 'ro1;s1;p2', 'ro1;s1;p3'],
			segmentId: 'MCxHIjO7_t3PRHpLiX0vbzwx4gg_',
		},
		{
			parts: ['ro1;s2;p1', 'ro1;s2;p2'],
			segmentId: 'Qz1OqWVatX_W4Sp5C0m8VhTTfME_',
		},
		{
			parts: ['ro1;s3;p1', 'ro1;s3;p2'],
			segmentId: '8GUNgE7zUulco2K3yuhJ1Fyceeo_',
		},
		{
			parts: ['ro1;s4;p1'],
			segmentId: 'XF9ZBDI5IouvkmTbounEfoJ6ijY_',
		},
	],
	newItem: (id: string, slug: string): MOS.IMOSROStory =>
		literal<MOS.IMOSROStory>({
			ID: new MOS.MosString128(id),
			Slug: new MOS.MosString128(slug),
			Items: [],
		}),
}
