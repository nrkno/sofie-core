import * as React from 'react'
import { ShowStyles, ShowStyle } from '../../../lib/collections/ShowStyles'
import { EditAttribute } from '../../lib/EditAttribute'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'

interface IProps {
	match: {
		params: {
			showStyleId: string
		}
	}
}
interface IState {
	showStyle: ShowStyle
}
interface ITrackedProps {
	showStyle?: ShowStyle
}
export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	return {
		showStyle: ShowStyles.findOne(props.match.params.showStyleId)
	}
})( class ShowStyleSettings extends React.Component<Translated<IProps & ITrackedProps>, IState> {
	renderEditForm () {
		const { t } = this.props

		return (
			<div className='studio-edit mod mhl mvs'>
				<div>
					<label className='field'>
						{t('Show Style name')}
						<div className='mdi'>
							<EditAttribute
								modifiedClassName='bghl'
								attribute='name'
								obj={this.props.showStyle}
								type='text'
								collection={ShowStyles}
								className='mdinput'></EditAttribute>
							<span className='mdfx'></span>
						</div>
					</label>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('Show Style id')}
							<EditAttribute
								modifiedClassName='bghl'
								attribute='_id'
								obj={this.props.showStyle}
								type='text'
								collection={ShowStyles}
								className='input text-input input-l'></EditAttribute>
						</label>
					</div>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('Baseline template id')}
							<EditAttribute
								modifiedClassName='bghl'
								attribute='baselineTemplate'
								obj={this.props.showStyle}
								type='text'
								collection={ShowStyles}
								className='input text-input input-l'></EditAttribute>
						</label>
					</div>
				</div>
			</div>
		)
	}

	render () {
		const { t } = this.props

		if (this.props.showStyle) {
			return this.renderEditForm()
		} else {
			return <Spinner />
		}
	}
})
