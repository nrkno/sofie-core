import { ExpectedPackageId, PeripheralDeviceId, RundownId, StudioId } from '../dataModel/Ids'
import * as MOS from 'mos-connection'
import { IngestPart, IngestRundown, IngestSegment } from '@sofie-automation/blueprints-integration'

export enum IngestJobs {
	RemoveRundown = 'removeRundown',
	UpdateRundown = 'updateRundown',
	RemoveSegment = 'removeSegment',
	UpdateSegment = 'updateSegment',
	UpdateSegmentRanks = 'updateSegmentRanks',
	RemovePart = 'removePart',
	UpdatePart = 'updatePart',
	RegenerateRundown = 'regenerateRundown',
	RegenerateSegment = 'regenerateSegment',

	MosRundown = 'mosRundown',
	MosRundownMetadata = 'mosRundownMetadata',
	MosFullStory = 'mosFullStory',
	MosDeleteStory = 'mosDeleteStory',
	MosInsertStory = 'mosInsertStory',
	MosMoveStory = 'mosMoveStory',
	MosSwapStory = 'mosSwapStory',

	ExpectedPackagesRegenerate = 'expectedPackagesRegenerate',
	PackageInfosUpdated = 'packageInfosUpdated',

	UserRemoveRundown = 'userRemoveRundown',
	UserUnsyncRundown = 'userUnsyncRundown',
}

export interface IngestPropsBase {
	rundownExternalId: string
	peripheralDeviceId: PeripheralDeviceId | null
}
export interface IngestRemoveRundownProps extends IngestPropsBase {
	forceDelete?: boolean
}
export interface IngestUpdateRundownProps extends IngestPropsBase {
	ingestRundown: IngestRundown
	isCreateAction: boolean
}
export interface IngestRemoveSegmentProps extends IngestPropsBase {
	segmentExternalId: string
}
export interface IngestUpdateSegmentProps extends IngestPropsBase {
	ingestSegment: IngestSegment
	isCreateAction: boolean
}
export interface IngestUpdateSegmentRanksProps extends IngestPropsBase {
	newRanks: { [segmentExternalId: string]: number }
}
export interface IngestRemovePartProps extends IngestPropsBase {
	segmentExternalId: string
	partExternalId: string
}
export interface IngestUpdatePartProps extends IngestPropsBase {
	segmentExternalId: string
	ingestPart: IngestPart
	isCreateAction: boolean
}
export type IngestRegenerateRundownProps = IngestPropsBase
export interface IngestRegenerateSegmentProps extends IngestPropsBase {
	segmentExternalId: string
}

export interface MosRundownProps extends IngestPropsBase {
	mosRunningOrder: MOS.IMOSRunningOrder
	isCreateAction: boolean
}
export interface MosRundownMetadataProps extends IngestPropsBase {
	mosRunningOrderBase: MOS.IMOSRunningOrderBase
}
export interface MosFullStoryProps extends IngestPropsBase {
	story: MOS.IMOSROFullStory
}
export interface MosDeleteStoryProps extends IngestPropsBase {
	stories: MOS.MosString128[]
}
export interface MosInsertStoryProps extends IngestPropsBase {
	insertBeforeStoryId: MOS.MosString128 | null
	replace: boolean
	newStories: MOS.IMOSROStory[]
}
export interface MosMoveStoryProps extends IngestPropsBase {
	insertBeforeStoryId: MOS.MosString128 | null
	stories: MOS.MosString128[]
}
export interface MosSwapStoryProps extends IngestPropsBase {
	story0: MOS.MosString128
	story1: MOS.MosString128
}

export interface ExpectedPackagesRegenerateProps {
	rundownId: RundownId
}
export interface PackageInfosUpdatedProps extends IngestPropsBase {
	packageIds: ExpectedPackageId[]
}

export interface UserRundownPropsBase {
	rundownId: RundownId
}
export interface UserRemoveRundownProps extends UserRundownPropsBase {
	force?: boolean
}
export type UserUnsyncRundownProps = UserRundownPropsBase

/**
 * Set of valid functions, of form:
 * `id: [data, return]`
 */
export type IngestJobFunc = {
	[IngestJobs.RemoveRundown]: (data: IngestRemoveRundownProps) => void
	[IngestJobs.UpdateRundown]: (data: IngestUpdateRundownProps) => void
	[IngestJobs.RemoveSegment]: (data: IngestRemoveSegmentProps) => void
	[IngestJobs.UpdateSegment]: (data: IngestUpdateSegmentProps) => void
	[IngestJobs.UpdateSegmentRanks]: (data: IngestUpdateSegmentRanksProps) => void
	[IngestJobs.RemovePart]: (data: IngestRemovePartProps) => void
	[IngestJobs.UpdatePart]: (data: IngestUpdatePartProps) => void
	[IngestJobs.RegenerateRundown]: (data: IngestRegenerateRundownProps) => void
	[IngestJobs.RegenerateSegment]: (data: IngestRegenerateSegmentProps) => void

	[IngestJobs.MosRundown]: (data: MosRundownProps) => void
	[IngestJobs.MosRundownMetadata]: (data: MosRundownMetadataProps) => void
	[IngestJobs.MosFullStory]: (data: MosFullStoryProps) => void
	[IngestJobs.MosDeleteStory]: (data: MosDeleteStoryProps) => void
	[IngestJobs.MosInsertStory]: (data: MosInsertStoryProps) => void
	[IngestJobs.MosMoveStory]: (data: MosMoveStoryProps) => void
	[IngestJobs.MosSwapStory]: (data: MosSwapStoryProps) => void

	[IngestJobs.ExpectedPackagesRegenerate]: (data: ExpectedPackagesRegenerateProps) => void
	[IngestJobs.PackageInfosUpdated]: (data: PackageInfosUpdatedProps) => void

	[IngestJobs.UserRemoveRundown]: (data: UserRemoveRundownProps) => void
	[IngestJobs.UserUnsyncRundown]: (data: UserUnsyncRundownProps) => void
}

// TODO - there should probably be a queue per rundown or something. To be improved later
export function getIngestQueueName(studioId: StudioId): string {
	return `ingest:${studioId}`
}
