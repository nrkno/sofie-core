import { PackageInfo } from '@sofie-automation/blueprints-integration'
import { MediaObject } from './collections/MediaObjects'
import { PieceStatusCode } from './collections/Pieces'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'

export interface ScanInfoForPackages {
	[packageId: string]: ScanInfoForPackage
}
export interface ScanInfoForPackage {
	/** Display name of the package  */
	packageName: string
	scan?: PackageInfo.FFProbeScan['payload']
	deepScan?: PackageInfo.FFProbeDeepScan['payload']
	timebase?: number // derived from scan
}

export interface PieceContentStatusObj {
	status: PieceStatusCode
	metadata: MediaObject | null
	packageInfos: ScanInfoForPackages | undefined
	messages: ITranslatableMessage[]
	contentDuration: undefined // TODO - why is this never set?
}
