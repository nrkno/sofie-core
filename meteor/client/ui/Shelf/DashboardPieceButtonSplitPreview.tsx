import * as React from 'react'
import ClassNames from 'classnames'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownUtils } from '../../lib/rundown'
import { SplitsContent } from '@sofie-automation/blueprints-integration'
import { PieceGeneric } from '../../../lib/collections/Pieces'
import { getSplitPreview, SplitRole } from '../../lib/ui/splitPreview'

interface IProps {
	piece: PieceGeneric
}

export const DashboardPieceButtonSplitPreview = translateWithTracker<IProps, {}, {}>((_props: IProps) => {
	return {}
})(
	class DashboardPieceButtonSplitPreview extends MeteorReactComponent<Translated<IProps>> {
		private objId: string

		constructor(props: IProps) {
			super(props)
		}

		render() {
			const subItems = getSplitPreview((this.props.piece.content as SplitsContent).boxSourceConfiguration)
			return (
				<div className="video-preview">
					{subItems.reverse().map((item, index, array) => {
						return (
							<div
								className={ClassNames(
									'video-preview',
									RundownUtils.getSourceLayerClassName(item.type),
									{
										background: item.role === SplitRole.ART,
										box: item.role === SplitRole.BOX,
									},
									{
										second: array.length > 1 && index > 0 && item.type === array[index - 1].type,
									}
								)}
								key={item._id + '-preview'}
								style={{
									left: ((item.content?.x ?? 0) * 100).toString() + '%',
									top: ((item.content?.y ?? 0) * 100).toString() + '%',
									width: ((item.content?.scale ?? 1) * 100).toString() + '%',
									height: ((item.content?.scale ?? 1) * 100).toString() + '%',
									clipPath:
										item.content && item.content.crop
											? `inset(${item.content.crop.top * 100}% ${item.content.crop.right * 100}% ${
													item.content.crop.bottom * 100
											  }% ${item.content.crop.left * 100}%)`
											: undefined,
								}}
							></div>
						)
					})}
				</div>
			)
		}
	}
)
