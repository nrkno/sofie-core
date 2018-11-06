import * as React from 'react'
import { ShowStyles, ShowStyle } from '../../../lib/collections/ShowStyles'
import { EditAttribute } from '../../lib/EditAttribute'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as _ from 'underscore'
import { Link } from 'react-router-dom'
import { ModalDialog } from '../../lib/ModalDialog'
import { literal } from '../../../lib/lib'
import { Random } from 'meteor/random'
import { ClientAPI } from '../../../lib/api/client'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { eventContextForLog } from '../../lib/eventTargetLogHelper'
import { Meteor } from 'meteor/meteor'

interface IProps {
	match: {
		params: {
			showStyleId: string
		}
	}
}
interface IState {
}
interface ITrackedProps {
	showStyle?: ShowStyle
}
export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	return {
		showStyle: ShowStyles.findOne(props.match.params.showStyleId)
	}
})( class ShowStyleSettings extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)
		this.state = {
		}
	}

	renderEditForm () {
		const { t } = this.props

		return (
			<div className='studio-edit mod mhl mvs'>
				<div>
					<label className='field'>
						{t('Blueprint Name')}
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
							{t('Blueprint ID')}
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
						<p>TODO: Version string</p>
					</div>
					<div className='mod mvs mhs'>
						<p>TODO: Upload new version</p>
					</div>
					<div className='mod mvs mhs'>
						<p>TODO: Manual edit (with warnings)</p>
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
