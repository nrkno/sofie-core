import React from 'react'
import { withTranslation } from 'react-i18next'
import { RundownLayouts } from '../../../../collections'
import { RundownLayoutBase, RundownLayoutType } from '../../../../../lib/collections/RundownLayouts'
import { EditAttribute } from '../../../../lib/EditAttribute'
import { MeteorReactComponent } from '../../../../lib/MeteorReactComponent'
import { Translated } from '../../../../lib/ReactMeteorData/ReactMeteorData'

interface IProps {
	item: RundownLayoutBase
}

interface IState {}

export default withTranslation()(
	class RundownHeaderLayoutSettings extends MeteorReactComponent<Translated<IProps>, IState> {
		render(): JSX.Element | null {
			const { t } = this.props

			return this.props.item.type === RundownLayoutType.RUNDOWN_HEADER_LAYOUT ? (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Expected End text')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={'plannedEndText'}
								obj={this.props.item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
							></EditAttribute>
							<span className="text-s dimmed">{t('Text to show above countdown to end of show')}</span>
						</label>
					</div>
				</React.Fragment>
			) : null
		}
	}
)
