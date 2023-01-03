import { ISourceLayer, PackageInfo } from '@sofie-automation/blueprints-integration'
import { ExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MediaObjects } from '../../lib/collections/MediaObjects'
import { PackageInfos } from '../../lib/collections/PackageInfos'
import { getPackageContainerPackageStatus } from '../../lib/globalStores'
import {
	PieceContentStatusPiece,
	PieceContentStatusStudio,
	PieceContentStatusObj,
	checkPieceContentStatus as libCheckPieceContentStatus,
} from '../../lib/mediaObjects'

export function checkPieceContentStatus(
	piece: PieceContentStatusPiece,
	sourceLayer: ISourceLayer | undefined,
	studio: PieceContentStatusStudio | undefined
): PieceContentStatusObj {
	const getMediaObject = (mediaId: string) => {
		if (studio) {
			return MediaObjects.findOne({
				studioId: studio._id,
				mediaId,
			})
		} else {
			return undefined
		}
	}

	const getPackageInfos = (packageId: ExpectedPackageId) => {
		if (studio) {
			return PackageInfos.find({
				studioId: studio._id,
				packageId: packageId,
				type: {
					$in: [PackageInfo.Type.SCAN, PackageInfo.Type.DEEPSCAN],
				},
			}).fetch()
		} else {
			return []
		}
	}

	const getPackageContainerPackageStatus2 = (packageContainerId: string, expectedPackageId: ExpectedPackageId) => {
		if (studio) {
			return getPackageContainerPackageStatus(studio._id, packageContainerId, expectedPackageId)
		} else {
			return undefined
		}
	}

	return libCheckPieceContentStatus(
		piece,
		sourceLayer,
		studio,
		getMediaObject,
		getPackageInfos,
		getPackageContainerPackageStatus2
	)
}
