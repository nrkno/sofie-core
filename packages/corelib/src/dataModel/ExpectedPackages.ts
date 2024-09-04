import { ExpectedPackage, Time } from '@sofie-automation/blueprints-integration'
import { protectString } from '../protectedString'
import { getHash, hashObj } from '../lib'
import {
	AdLibActionId,
	BucketAdLibActionId,
	BucketAdLibId,
	BucketId,
	ExpectedPackageId,
	PartId,
	PartInstanceId,
	PieceId,
	PieceInstanceId,
	RundownBaselineAdLibActionId,
	RundownId,
	SegmentId,
	StudioId,
} from './Ids'
import { ReadonlyDeep } from 'type-fest'

/*
 Expected Packages are created from Pieces in the rundown.
 A "Package" is a generic term for a "thing that can be played", such as media files, audio, graphics etc..
 The blueprints generate Pieces with expectedPackages on them.
 These are then picked up by a Package Manager who then tries to fullfill the expectations.
 Example: An ExpectedPackage could be a "Media file to be present on the location used by a playout device".
   The Package Manager will then copy the file to the right place.
*/

export type ExpectedPackageFromRundown = ExpectedPackageDBFromPiece | ExpectedPackageDBFromAdLibAction

export type ExpectedPackageFromRundownBaseline =
	| ExpectedPackageDBFromBaselineAdLibAction
	| ExpectedPackageDBFromBaselineAdLibPiece
	| ExpectedPackageDBFromRundownBaselineObjects

export type ExpectedPackageDBFromBucket = ExpectedPackageDBFromBucketAdLib | ExpectedPackageDBFromBucketAdLibAction

export type ExpectedPackageDB =
	| ExpectedPackageFromRundown
	| ExpectedPackageDBFromBucket
	| ExpectedPackageFromRundownBaseline
	| ExpectedPackageDBFromStudioBaselineObjects

export enum ExpectedPackageDBType {
	PIECE = 'piece',
	ADLIB_PIECE = 'adlib_piece',
	ADLIB_ACTION = 'adlib_action',
	BASELINE_ADLIB_PIECE = 'baseline_adlib_piece',
	BASELINE_ADLIB_ACTION = 'baseline_adlib_action',
	BUCKET_ADLIB = 'bucket_adlib',
	BUCKET_ADLIB_ACTION = 'bucket_adlib_action',
	RUNDOWN_BASELINE_OBJECTS = 'rundown_baseline_objects',
	STUDIO_BASELINE_OBJECTS = 'studio_baseline_objects',
	PIECE_INSTANCE = 'piece_instance',
}
export interface ExpectedPackageDBBaseSimple {
	_id: ExpectedPackageId

	package: ReadonlyDeep<ExpectedPackage.Any>

	/** The local package id - as given by the blueprints */
	blueprintPackageId: string // TODO - remove this?

	/** The studio of the Rundown of the Piece this package belongs to */
	studioId: StudioId

	/** Hash that changes whenever the content or version changes. See getContentVersionHash() */
	contentVersionHash: string

	created: Time
}

/*
 * What about this new concept. The aim here is to avoid the constant inserting and deleting of expectedPackages during playout, and avoiding duplicate packages with the same content.
 * The idea is to have a single expectedPackage for each 'content'.
 * Ingest will 'deduplicate' the packages produced by the blueprints, with playout able to reference them with pieceInstanceIds.
 *
 * During the ingest save phase, it will need to reload the `playoutSources` property, in case it has changed. And if there are uses remaining, it will need to keep the package after clearing the `ingestSources`.
 * During playout operations, pieceInstanceIds will be added and removed as needed. If there remains no sources (of either type), then the document can be removed. If an in-progress ingest tried to reclaim it, it will get reinserted.
 *
 * Playout can then load just the ones referenced by piece instances, and just before it needs to use them (for bluerpint types or something), can ensure that everything needed has been loaded.
 * During a take, any packages referenced by the previous(?) partinstance must be removed.
 * When doing a reset of the rundown, all playout references must be removed.
 * When inserting/removing pieceinstances, the expectedPackages must be updated.
 */
export interface ExpectedPackageDBNew {
	_id: ExpectedPackageId // derived from rundownId and hash of `package`

	// /** The local package id - as given by the blueprints */
	// blueprintPackageId: string // TODO - remove this?

	/** The studio of the Rundown of the Piece this package belongs to */
	studioId: StudioId

	/** The rundown of the Piece this package belongs to */
	rundownId: RundownId

	/** Hash that changes whenever the content or version changes. See getContentVersionHash() */
	contentVersionHash: string

	created: Time

	package: ReadonlyDeep<ExpectedPackage.Any>

	ingestSources: ExpectedPackageIngestSource[]

	playoutSources: {
		/** Any playout PieceInstance. This is limited to the current and next partInstances */ // nocommit - verify this
		pieceInstanceIds: PieceInstanceId[]
	}
}

export interface ExpectedPackageIngestSourcePiece {
	fromPieceType: ExpectedPackageDBType.PIECE | ExpectedPackageDBType.ADLIB_PIECE
	/** The Piece this package belongs to */
	pieceId: PieceId
	/** The Part this package belongs to */
	partId: PartId
	/** The Segment this package belongs to */
	segmentId: SegmentId
}
export interface ExpectedPackageIngestSourceAdlibAction {
	fromPieceType: ExpectedPackageDBType.ADLIB_ACTION
	/** The Piece this package belongs to */
	pieceId: AdLibActionId
	/** The Part this package belongs to */
	partId: PartId
	/** The Segment this package belongs to */
	segmentId: SegmentId
}
export interface ExpectedPackageIngestSourceBaselineAdlibPiece {
	fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_PIECE
	/** The Piece this package belongs to */
	pieceId: PieceId
}
export interface ExpectedPackageIngestSourceBaselineAdlibAction {
	fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_ACTION
	/** The Piece this package belongs to */
	pieceId: RundownBaselineAdLibActionId
}
export interface ExpectedPackageIngestSourceBaselineObjects {
	fromPieceType: ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS
}

export type ExpectedPackageIngestSourcePart = ExpectedPackageIngestSourcePiece | ExpectedPackageIngestSourceAdlibAction

export type ExpectedPackageIngestSourceRundownBaseline =
	| ExpectedPackageIngestSourceBaselineAdlibPiece
	| ExpectedPackageIngestSourceBaselineAdlibAction
	| ExpectedPackageIngestSourceBaselineObjects

export type ExpectedPackageIngestSource = ExpectedPackageIngestSourcePart | ExpectedPackageIngestSourceRundownBaseline

export interface ExpectedPackageWithId {
	_id: ExpectedPackageId
	expectedPackage: ReadonlyDeep<ExpectedPackage.Any>
}

export interface ExpectedPackageDBBase extends ExpectedPackageDBBaseSimple {
	fromPieceType: ExpectedPackageDBType
}
export interface ExpectedPackageDBFromPiece extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.PIECE | ExpectedPackageDBType.ADLIB_PIECE
	/** The Piece this package belongs to */
	pieceId: PieceId
	/** The Part this package belongs to */
	partId: PartId
	/** The Segment this package belongs to */
	segmentId: SegmentId
	/** The rundown of the Piece this package belongs to */
	rundownId: RundownId
}

export interface ExpectedPackageDBFromBaselineAdLibPiece extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_PIECE
	/** The Piece this package belongs to */
	pieceId: PieceId
	/** The rundown of the Piece this package belongs to */
	rundownId: RundownId
}

export interface ExpectedPackageDBFromAdLibAction extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.ADLIB_ACTION
	/** The Adlib Action this package belongs to */
	pieceId: AdLibActionId
	/** The Part this package belongs to */
	partId: PartId
	/** The Segment this package belongs to */
	segmentId: SegmentId
	/** The rundown of the Piece this package belongs to */
	rundownId: RundownId
}
export interface ExpectedPackageDBFromBaselineAdLibAction extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_ACTION
	/** The Piece this package belongs to */
	pieceId: RundownBaselineAdLibActionId
	/** The rundown of the Piece this package belongs to */
	rundownId: RundownId
}

export interface ExpectedPackageDBFromRundownBaselineObjects extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS
	/** The rundown of the Piece this package belongs to */
	rundownId: RundownId
	pieceId: null
}
export interface ExpectedPackageDBFromStudioBaselineObjects extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS
	pieceId: null
}

export interface ExpectedPackageDBFromBucketAdLib extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB
	bucketId: BucketId
	/** The Bucket adlib this package belongs to */
	pieceId: BucketAdLibId
	/** The `externalId` of the Bucket adlib this package belongs to */
	pieceExternalId: string
}
export interface ExpectedPackageDBFromBucketAdLibAction extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION
	bucketId: BucketId
	/** The Bucket adlib-action this package belongs to */
	pieceId: BucketAdLibActionId
	/** The `externalId` of the Bucket adlib-action this package belongs to */
	pieceExternalId: string
}

export function getContentVersionHash(expectedPackage: ReadonlyDeep<Omit<ExpectedPackage.Any, '_id'>>): string {
	return hashObj({
		content: expectedPackage.content,
		version: expectedPackage.version,
		// todo: should expectedPackage.sources.containerId be here as well?
	})
}

export function getExpectedPackageId(
	/** _id of the owner (the piece, adlib etc..) */
	ownerId:
		| PieceId
		| PieceInstanceId
		| AdLibActionId
		| RundownBaselineAdLibActionId
		| BucketAdLibId
		| BucketAdLibActionId
		| RundownId
		| StudioId,
	/** The locally unique id of the expectedPackage */
	localExpectedPackageId: ExpectedPackage.Base['_id']
): ExpectedPackageId {
	return protectString(`${ownerId}_${getHash(localExpectedPackageId)}`)
}

export function getExpectedPackageIdNew(
	/** _id of the rundown*/
	rundownId: RundownId,
	/** The locally unique id of the expectedPackage */
	expectedPackage: ReadonlyDeep<ExpectedPackage.Any>
): ExpectedPackageId {
	// This may be too agressive, but we don't know how to merge some of the properties
	const objHash = hashObj({
		...expectedPackage,
		listenToPackageInfoUpdates: false, // Not relevant for the hash
	} satisfies ReadonlyDeep<ExpectedPackage.Any>)

	return protectString(`${rundownId}_${getHash(objHash)}`)
}

export function unwrapExpectedPackages(
	expectedPackages: ReadonlyDeep<ExpectedPackageDBBase[]> | undefined
): ReadonlyDeep<ExpectedPackage.Any[]> {
	if (!expectedPackages) return []
	return expectedPackages.map((p) => p.package)
}
