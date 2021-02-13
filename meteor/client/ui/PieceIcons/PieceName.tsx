import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { SourceLayerType, ISourceLayer } from '@sofie-automation/blueprints-integration'

import { PubSub } from '../../../lib/api/pubsub'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { IPropsHeader } from './PieceIcon'
import { findPieceInstanceToShow } from './utils'

interface INamePropsHeader extends IPropsHeader {
	partName: string
}

const supportedLayers = new Set([SourceLayerType.GRAPHICS, SourceLayerType.LIVE_SPEAK, SourceLayerType.VT])

export const PieceNameContainer = withTracker((props: INamePropsHeader) => {
	return findPieceInstanceToShow(props, supportedLayers)
})(
	class PieceNameContainer extends MeteorReactComponent<
		INamePropsHeader & { sourceLayer: ISourceLayer; pieceInstance: PieceInstance }
	> {
		componentDidMount() {
			this.subscribe(PubSub.pieceInstancesSimple, {
				rundownId: { $in: this.props.rundownIds },
			})
			this.subscribe(PubSub.showStyleBases, {
				_id: this.props.showStyleBaseId,
			})
		}

		render() {
			if (this.props.sourceLayer && supportedLayers.has(this.props.sourceLayer.type)) {
				return this.props.pieceInstance.piece.name
			}
			return this.props.partName || ''
		}
	}
)
