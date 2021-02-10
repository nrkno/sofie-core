import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, Time, ProtectedString, hashObj } from '../lib'
import { createMongoCollection } from './lib'
import { RundownId } from './Rundowns'
import { ResultingMappingRoutes, StudioId } from './Studios'
import { PieceId } from './Pieces'
import { registerIndex } from '../database'
import { AdLibActionId } from './AdLibActions'
import { BucketAdLibId } from './BucketAdlibs'
import { BucketAdLibActionId } from './BucketAdlibActions'
/*
 Expected Packages are created from Pieces in the rundown.
 A "Package" is a generic term for a "thing that can be played", such as media files, audio, graphics etc..
 The blueprints generate Pieces with expectedPackages on them.
 These are then picked up by a Package Manager who then tries to fullfill the expectations.
 Example: An ExpectedPackage could be a "Media file to be present on the location used by a playout device".
   The Package Manager will then copy the file to the right place.
*/

export type ExpectedPackageId = ProtectedString<'ExpectedPackageId'>

export type ExpectedPackageDB =
	| ExpectedPackageDBFromPiece
	| ExpectedPackageDBFromAdLibAction
	| ExpectedPackageDBFromBucketAdLib
	| ExpectedPackageDBFromBucketAdLibAction

export enum ExpectedPackageDBType {
	PIECE = 'piece',
	ADLIB_ACTION = 'adlib_action',
	BUCKET_ADLIB = 'bucket_adlib',
	BUCKET_ADLIB_ACTION = 'bucket_adlib_action',
}
export interface ExpectedPackageDBBase extends Omit<ExpectedPackage.Base, '_id'> {
	_id: ExpectedPackageId

	/** The studio of the Rundown of the Piece this package belongs to */
	studioId: StudioId

	/** Hash that changes whenever the content or version changes. See getContentVersionHash() */
	contentVersionHash: string

	pieceId: ProtectedString<any>
	fromPieceType: ExpectedPackageDBType
}
export interface ExpectedPackageDBFromPiece extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.PIECE
	/** The Piece this package belongs to */
	pieceId: PieceId
	/** The rundown of the Piece this package belongs to */
	rundownId: RundownId
}

export interface ExpectedPackageDBFromAdLibAction extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.ADLIB_ACTION
	/** The Piece this package belongs to */
	pieceId: AdLibActionId
	/** The rundown of the Piece this package belongs to */
	rundownId: RundownId
}
export interface ExpectedPackageDBFromBucketAdLib extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB
	/** The Bucket adlib this package belongs to */
	pieceId: BucketAdLibId
}
export interface ExpectedPackageDBFromBucketAdLibAction extends ExpectedPackageDBBase {
	fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION
	/** The Bucket adlib-action this package belongs to */
	pieceId: BucketAdLibActionId
}
export const ExpectedPackages: TransformedCollection<ExpectedPackageDB, ExpectedPackageDB> = createMongoCollection<
	ExpectedPackageDB
>('expectedPackages')
registerCollection('ExpectedPackages', ExpectedPackages)

registerIndex(ExpectedPackages, {
	studioId: 1,
})
export function getContentVersionHash(expectedPackage: Omit<ExpectedPackage.Any, '_id'>): string {
	return hashObj({
		content: expectedPackage.content,
		version: expectedPackage.version,
		// todo: should expectedPackage.sources.containerId be here as well?
	})
}
