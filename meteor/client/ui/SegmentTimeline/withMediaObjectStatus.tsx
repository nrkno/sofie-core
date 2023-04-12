import React, { useContext, useMemo } from 'react'
import { PieceUi } from './SegmentTimelineContainer'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../lib/rundown'
import { IAdLibListItem } from '../Shelf/AdLibListItem'
import { BucketAdLibUi, BucketAdLibActionUi } from '../Shelf/RundownViewBuckets'

import { AdLibPieceUi } from '../../lib/shelf'
import { UIStudio } from '../../../lib/api/studios'
import { ExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useConditionalSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { PubSub } from '../../../lib/api/pubsub'
import StudioContext from '../RundownView/StudioContext'
import { getMediaObjectMediaId } from '../../../lib/mediaObjects'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { checkPieceContentStatus } from '../../lib/mediaObjects'
import { slowDownReactivity } from '../../lib/reactiveData/reactiveDataHelper'

type SomePiece = BucketAdLibUi | IAdLibListItem | AdLibPieceUi | PieceUi | BucketAdLibActionUi

type AnyPiece = {
	piece?: SomePiece | undefined
	layer?: ISourceLayer | undefined
	isLiveLine?: boolean
	studio: UIStudio | undefined
}

const NEVER = '__do_not_match_on_anything'
const PROTECTED_NEVER = protectString(NEVER)

export function useMediaObjectStatus<T extends SomePiece>(
	piece: T | undefined,
	sourceLayer?: ISourceLayer
): T | undefined {
	const layer = useMemo(() => piece?.sourceLayer ?? sourceLayer, [piece, sourceLayer])

	const unwrappedPiece = useMemo(() => {
		if (!piece) return undefined
		if (RundownUtils.isAdLibPieceOrAdLibListItem(piece)) return piece
		return piece?.instance.piece
	}, [piece])

	const studio = useContext(StudioContext)

	const objId = useMemo(
		() => unwrappedPiece && layer && getMediaObjectMediaId(unwrappedPiece, layer),
		[unwrappedPiece, layer]
	)

	useConditionalSubscription(PubSub.mediaObjects, !!(objId && studio?._id), studio?._id ?? PROTECTED_NEVER, {
		mediaId: objId ?? NEVER,
	})

	const expectedPackageIds = useMemo(() => {
		if (!unwrappedPiece?.expectedPackages || unwrappedPiece.expectedPackages.length === 0) return undefined

		const result: ExpectedPackageId[] = []
		for (let i = 0; i < unwrappedPiece.expectedPackages.length; i++) {
			const expectedPackage = unwrappedPiece.expectedPackages[i]
			const id = expectedPackage._id || '__unnamed' + i

			result.push(getExpectedPackageId(unwrappedPiece._id, id))
		}

		return result
	}, [unwrappedPiece])

	useConditionalSubscription(PubSub.packageInfos, !!(studio?._id && expectedPackageIds?.length), {
		studioId: studio?._id ?? PROTECTED_NEVER,
		packageId: { $in: expectedPackageIds ?? [] },
	})

	const processedPiece = useTracker(() => {
		if (!unwrappedPiece || !piece || !studio) return undefined

		// const { metadata, packageInfos, status, contentDuration, messages } = uiPieceContentStatus.status

		const { metadata, packageInfos, status, contentDuration, messages } = slowDownReactivity(
			() => checkPieceContentStatus(unwrappedPiece, piece.sourceLayer ?? layer, studio),
			250
		)

		if (RundownUtils.isAdLibPieceOrAdLibListItem(piece)) {
			const pieceCopy = {
				...piece,
				status,
				contentMetaData: metadata,
				contentPackageInfos: packageInfos,
				messages,
			}

			if (pieceCopy.content && pieceCopy.content.sourceDuration === undefined && contentDuration !== undefined) {
				pieceCopy.content.sourceDuration = contentDuration
			}

			return pieceCopy
		} else {
			const pieceCopy = {
				...piece,
				instance: {
					...piece.instance,
					piece: {
						...piece.instance.piece,
						status,
					},
				},
				contentMetaData: metadata,
				contentPackageInfos: packageInfos,
				messages,
			}

			if (
				pieceCopy.instance.piece.content &&
				pieceCopy.instance.piece.content.sourceDuration === undefined &&
				contentDuration !== undefined
			) {
				pieceCopy.instance.piece.content.sourceDuration = contentDuration
			}

			return pieceCopy
		}
	}, [unwrappedPiece, piece, studio])

	return processedPiece
}

export const withMediaObjectStatus = <TProps extends AnyPiece>() => {
	return (WrappedComponent: React.ComponentType<TProps>): React.ComponentType<TProps> => {
		return function WithMediaObjectStatusHOC(props: TProps): JSX.Element {
			const processedPiece = useMediaObjectStatus(props.piece, props.layer)

			const overrides = useMemo(
				() => ({
					piece: processedPiece ?? props.piece,
				}),
				[processedPiece, props.piece]
			)

			return <WrappedComponent {...props} {...overrides} />
		}
	}
}
