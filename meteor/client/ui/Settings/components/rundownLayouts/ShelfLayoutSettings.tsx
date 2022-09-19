import React from 'react'
import { withTranslation } from 'react-i18next'
import { RundownLayoutBase, RundownLayouts, RundownLayoutType } from '../../../../../lib/collections/RundownLayouts'
import { EditAttribute } from '../../../../lib/EditAttribute'
import { MeteorReactComponent } from '../../../../lib/MeteorReactComponent'
import { Translated } from '../../../../lib/ReactMeteorData/ReactMeteorData'

interface IProps {
	item: RundownLayoutBase
}

interface IState {}

export default withTranslation()(
	class ShelfLayoutSettings extends MeteorReactComponent<Translated<IProps>, IState> {
		render() {
			const { t } = this.props

			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Expose layout as a standalone page')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={'exposeAsStandalone'}
								obj={this.props.item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							></EditAttribute>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Open shelf by default')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={'openByDefault'}
								obj={this.props.item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							></EditAttribute>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Default shelf height')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`startingHeight`}
								obj={this.props.item}
								type="int"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Disable Context Menu')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={'disableContextMenu'}
								obj={this.props.item}
								options={RundownLayoutType}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							></EditAttribute>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Show Inspector')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={'showInspector'}
								obj={this.props.item}
								options={RundownLayoutType}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							></EditAttribute>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Hide default AdLib Start/Execute options')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={'hideDefaultStartExecute'}
								obj={this.props.item}
								options={RundownLayoutType}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							></EditAttribute>
							<span className="text-s dimmed">{t('Only custom trigger modes will be shown')}</span>
						</label>
					</div>
				</React.Fragment>
			)
		}
	}
)
