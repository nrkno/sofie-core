import {
	AdLibActionId,
	BucketAdLibActionId,
	BucketId,
	ExpectedPackageId,
	PeripheralDeviceId,
	PieceId,
	RundownId,
	SegmentId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '../dataModel/Ids'
import type * as MOS from 'mos-connection'
import { IngestAdlib, IngestPart, IngestRundown, IngestSegment } from '@sofie-automation/blueprints-integration'
import { BucketAdLibAction } from '../dataModel/BucketAdLibAction'

export enum IngestJobs {
	RemoveRundown = 'removeRundown',
	UpdateRundown = 'updateRundown',
	UpdateRundownMetaData = 'updateRundownMetaData',
	RemoveSegment = 'removeSegment',
	UpdateSegment = 'updateSegment',
	UpdateSegmentRanks = 'updateSegmentRanks',
	RemovePart = 'removePart',
	UpdatePart = 'updatePart',
	RegenerateRundown = 'regenerateRundown',
	RegenerateSegment = 'regenerateSegment',

	RemoveOrphanedSegments = 'removeOrphanedSegments',

	MosRundown = 'mosRundown',
	MosRundownMetadata = 'mosRundownMetadata',
	MosRundownStatus = 'mosRundownStatus',
	MosRundownReadyToAir = 'mosRundownReadyToAir',
	MosStoryStatus = 'mosStoryStatus',
	MosFullStory = 'mosFullStory',
	MosDeleteStory = 'mosDeleteStory',
	MosInsertStory = 'mosInsertStory',
	MosMoveStory = 'mosMoveStory',
	MosSwapStory = 'mosSwapStory',

	ExpectedPackagesRegenerate = 'expectedPackagesRegenerate',
	PackageInfosUpdated = 'packageInfosUpdated',

	UserRemoveRundown = 'userRemoveRundown',
	UserUnsyncRundown = 'userUnsyncRundown',

	// For now these are in this queue, but if this gets split up to be per rundown, then a single bucket queue will be needed
	BucketItemImport = 'bucketItemImport',
	BucketActionRegenerateExpectedPackages = 'bucketActionRegenerateExpectedPackages',
	BucketActionModify = 'bucketActionModify',
	BucketPieceModify = 'bucketPieceModify',
	BucketRemoveAdlibPiece = 'bucketRemoveAdlibPiece',
	BucketRemoveAdlibAction = 'bucketRemoveAdlibAction',
	BucketEmpty = 'bucketEmpty',
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
	isCreateAction: boolean // TODO: Document what isCreateAction means
}
export interface IngestUpdateRundownMetaDataProps extends IngestPropsBase {
	ingestRundown: Omit<IngestRundown, 'segments'>
}
export interface IngestRemoveSegmentProps extends IngestPropsBase {
	segmentExternalId: string
}
export interface IngestUpdateSegmentProps extends IngestPropsBase {
	ingestSegment: IngestSegment
	isCreateAction: boolean // TODO: Document what isCreateAction means
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
	isCreateAction: boolean // TODO: Document what isCreateAction means
}
export type IngestRegenerateRundownProps = IngestPropsBase
export interface IngestRegenerateSegmentProps extends IngestPropsBase {
	segmentExternalId: string
}

export interface RemoveOrphanedSegmentsProps extends IngestPropsBase {
	orphanedDeletedSegmentIds: SegmentId[]
	orphanedHiddenSegmentIds: SegmentId[]
}

export interface MosRundownProps extends IngestPropsBase {
	mosRunningOrder: MOS.IMOSRunningOrder
	isCreateAction: boolean // TODO: Document what isCreateAction means
}
export interface MosRundownMetadataProps extends IngestPropsBase {
	mosRunningOrderBase: MOS.IMOSRunningOrderBase
}
export interface MosRundownStatusProps extends IngestPropsBase {
	status: string
}
export interface MosRundownReadyToAirProps extends IngestPropsBase {
	status: string
}
export interface MosStoryStatusProps extends IngestPropsBase {
	partExternalId: string
	status: string
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

export interface BucketItemImportProps {
	bucketId: BucketId
	showStyleBaseId: ShowStyleBaseId
	showStyleVariantIds?: ShowStyleVariantId[]
	payload: IngestAdlib
}
export interface BucketActionRegenerateExpectedPackagesProps {
	actionId: BucketAdLibActionId
}
export interface BucketActionModifyProps {
	actionId: BucketAdLibActionId
	props: Partial<Omit<BucketAdLibAction, '_id'>>
}
export interface BucketPieceModifyProps {
	pieceId: PieceId
	props: Partial<Omit<BucketAdLibAction, '_id'>>
}
export interface BucketRemoveAdlibPieceProps {
	pieceId: PieceId
}
export interface BucketRemoveAdlibActionProps {
	actionId: AdLibActionId
}
export interface BucketEmptyProps {
	bucketId: BucketId
}

/**
 * Set of valid functions, of form:
 * `id: (data) => return`
 */
export type IngestJobFunc = {
	[IngestJobs.RemoveRundown]: (data: IngestRemoveRundownProps) => void
	[IngestJobs.UpdateRundown]: (data: IngestUpdateRundownProps) => void
	[IngestJobs.UpdateRundownMetaData]: (data: IngestUpdateRundownMetaDataProps) => void
	[IngestJobs.RemoveSegment]: (data: IngestRemoveSegmentProps) => void
	[IngestJobs.UpdateSegment]: (data: IngestUpdateSegmentProps) => void
	[IngestJobs.UpdateSegmentRanks]: (data: IngestUpdateSegmentRanksProps) => void
	[IngestJobs.RemovePart]: (data: IngestRemovePartProps) => void
	[IngestJobs.UpdatePart]: (data: IngestUpdatePartProps) => void
	[IngestJobs.RegenerateRundown]: (data: IngestRegenerateRundownProps) => void
	[IngestJobs.RegenerateSegment]: (data: IngestRegenerateSegmentProps) => void

	[IngestJobs.RemoveOrphanedSegments]: (data: RemoveOrphanedSegmentsProps) => void

	[IngestJobs.MosRundown]: (data: MosRundownProps) => void
	[IngestJobs.MosRundownMetadata]: (data: MosRundownMetadataProps) => void
	[IngestJobs.MosRundownStatus]: (data: MosRundownStatusProps) => void
	[IngestJobs.MosRundownReadyToAir]: (data: MosRundownReadyToAirProps) => void
	[IngestJobs.MosStoryStatus]: (data: MosStoryStatusProps) => void
	[IngestJobs.MosFullStory]: (data: MosFullStoryProps) => void
	[IngestJobs.MosDeleteStory]: (data: MosDeleteStoryProps) => void
	[IngestJobs.MosInsertStory]: (data: MosInsertStoryProps) => void
	[IngestJobs.MosMoveStory]: (data: MosMoveStoryProps) => void
	[IngestJobs.MosSwapStory]: (data: MosSwapStoryProps) => void

	[IngestJobs.ExpectedPackagesRegenerate]: (data: ExpectedPackagesRegenerateProps) => void
	[IngestJobs.PackageInfosUpdated]: (data: PackageInfosUpdatedProps) => void

	[IngestJobs.UserRemoveRundown]: (data: UserRemoveRundownProps) => void
	[IngestJobs.UserUnsyncRundown]: (data: UserUnsyncRundownProps) => void

	[IngestJobs.BucketItemImport]: (data: BucketItemImportProps) => void
	[IngestJobs.BucketActionModify]: (data: BucketActionModifyProps) => void
	[IngestJobs.BucketPieceModify]: (data: BucketPieceModifyProps) => void
	[IngestJobs.BucketActionRegenerateExpectedPackages]: (data: BucketActionRegenerateExpectedPackagesProps) => void
	[IngestJobs.BucketRemoveAdlibPiece]: (data: BucketRemoveAdlibPieceProps) => void
	[IngestJobs.BucketRemoveAdlibAction]: (data: BucketRemoveAdlibActionProps) => void
	[IngestJobs.BucketEmpty]: (data: BucketEmptyProps) => void
}

// TODO - there should probably be a queue per rundown or something. To be improved later
export function getIngestQueueName(studioId: StudioId): string {
	return `ingest:${studioId}`
}
