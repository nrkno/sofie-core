import { TransformedCollection } from '../typings/meteor'
import { registerCollection, ProtectedString, protectString } from '../lib'
import { createMongoCollection } from './lib'
import { StudioId } from './Studios'
import { registerIndex } from '../database'
import { ExpectedPackageDB, ExpectedPackageId } from './ExpectedPackages'
import { PeripheralDeviceId } from './PeripheralDevices'
import { Anomaly, FieldOrder } from './MediaObjects'

/**
 * The PackageInfos collection contains information related to Packages.
 * This collection is populated from a Package Manager-device.
 */

export type PackageInfoId = ProtectedString<'PackageInfoId'>

export interface PackageInfoBase {
	_id: PackageInfoId

	/** Reference to the Package this document has info about */
	packageId: ExpectedPackageId
	/** Reference to the contentVersionHash of the ExpectedPackage, used to reference the expected content+version of the Package */
	expectedContentVersionHash: ExpectedPackageDB['contentVersionHash']
	/** Referring to the actual contentVersionHash of the Package, used to reference the exact content+version of the Package */
	actualContentVersionHash: string

	/** The studio this Package is in */
	studioId: StudioId

	/** Which PeripheralDevice this info comes from */
	deviceId: PeripheralDeviceId

	type: PackageInfoDBType
	payload: any
}

export type PackageInfoDB = PackageInfoFFProbeScan | PackageInfoFFProbeDeepScan | PackageInfoFFOther
export interface PackageInfoFFProbeScan extends PackageInfoBase {
	type: PackageInfoDBType.SCAN
	payload: FFProbeInfo
}
export interface PackageInfoFFProbeDeepScan extends PackageInfoBase {
	type: PackageInfoDBType.DEEPSCAN
	payload: FFProbeDeepScan
}
export interface PackageInfoFFOther extends PackageInfoBase {
	// placeholder
	type: PackageInfoDBType.OTHER
	payload: {}
}
export enum PackageInfoDBType {
	SCAN = 'scan',
	DEEPSCAN = 'deepScan',
	OTHER = 'other',
}

export const PackageInfos: TransformedCollection<PackageInfoDB, PackageInfoDB> =
	createMongoCollection<PackageInfoDB>('packageInfos')
registerCollection('PackageInfos', PackageInfos)

registerIndex(PackageInfos, {
	studioId: 1,
})
export function getPackageInfoId(packageId: ExpectedPackageId, type: string): PackageInfoId {
	return protectString(`${packageId}_${type}`)
}

export interface FFProbeInfo {
	streams?: FFProbeScanStream[]
	format?: FFProbeScanFormat
}
export interface FFProbeScanStream {
	index?: number
	codec_type?: string // Example: 'video', 'audio'

	// video
	width?: number // Example: 1920
	height?: number // Example: 1080
	sample_aspect_ratio?: string // Example: '1:1'
	display_aspect_ratio?: string // Example: '16:9'
	pix_fmt?: string // Example: 'yuv420p'
	bits_per_raw_sample?: string // Example: '8'

	// audio
	sample_fmt?: string
	sample_rate?: string
	channels?: number
	channel_layout?: string
	bits_per_sample?: number

	codec_name?: string // Example: 'h264'
	codec_long_name?: string // Example: 'H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10'
	profile?: string // Example: 'Main'
	codec_time_base?: string // Example: '1/50'
	codec_tag_string?: string // Example: 'avc1'
	codec_tag?: string // Example: '0x31637661'
	coded_width?: number // Example: 1920
	coded_height?: number // Example: 1088
	has_b_frames?: number // Example: 2
	level?: number // Example: 40
	color_range?: string // Example: 'tv'
	color_space?: string // Example: 'bt709'
	color_transfer?: string // Example: 'bt709'
	color_primaries?: string // Example: 'bt709'
	chroma_location?: string // Example: 'left'
	refs?: number // Example: 1
	is_avc?: string // Example: 'true'
	nal_length_size?: string // Example: '4'
	r_frame_rate?: string // Example: '25/1'
	avg_frame_rate?: string // Example: '25/1'
	time_base?: string // Example: '1/90000'
	start_pts?: number // Example: 0
	start_time?: string // Example: '0.000000'
	duration_ts?: number // Example: 964800
	duration?: string // Example: '10.720000'
	bit_rate?: string // Example: '4806776'
	nb_frames?: string // Example: '268'
	disposition?: any // lookup this?
	tags?: any // lookup this?
	max_bit_rate?: string // ?
}
export interface FFProbeScanFormat {
	filename?: string // Example: 'C:\\media\\AMB.mp4'
	nb_streams?: number // Example: 1
	nb_programs?: number // Example: 0
	format_name?: string // Example: 'mov,mp4,m4a,3gp,3g2,mj2'
	format_long_name?: string // Example: 'QuickTime / MOV'
	start_time?: string // Example: '0.000000'
	duration?: string // Example: '10.720000'
	size?: string // Example: '6445960'
	bit_rate?: string // Example: '4810417'
	max_bit_rate?: number // ?
	probe_score?: number // Example: 100
	tags?: {
		major_brand?: string // Example: 'mp42'
		minor_version?: string // Example: '0'
		compatible_brands?: string // Example: 'mp42isomavc1'
		creation_time?: string // Example: '2012-10-23T08:11:18.000000Z'
		encoder?: string // Example: 'HandBrake 0.9.8 2012071800'
	}
}

export interface FFProbeDeepScan {
	field_order?: FieldOrder
	scenes?: number[]
	freezes?: Anomaly[]
	blacks?: Anomaly[]
}
