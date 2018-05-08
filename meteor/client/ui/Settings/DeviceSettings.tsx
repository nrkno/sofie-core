import * as ClassNames from 'classnames'
import * as React from 'react'
import { InjectedTranslateProps, translate } from 'react-i18next'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { EditAttribute } from '../../lib/EditAttribute'
import { ModalDialog } from '../../lib/ModalDialog'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { literal } from '../../../lib/lib'
import { Random } from 'meteor/random'
import * as faTrash from '@fontawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fontawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fontawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fontawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fontawesome/react-fontawesome'

interface IPropsHeader {
	device: PeripheralDevice
}

class PlayoutDeviceSettings extends React.Component<IPropsHeader & InjectedTranslateProps> {
	render () {
		const { t } = this.props

		return (
			<div>
				<label className='field'>
					{t('Initialize as clear')}
					<EditAttribute
						modifiedClassName='bghl'
						attribute={'initializeAsClear'}
						obj={this.props.device}
						type='checkbox'
						collection={PeripheralDevices}
						className=''></EditAttribute>
				</label>
			</div>
		)
	}
}

class MosDeviceSettings extends React.Component<IPropsHeader & InjectedTranslateProps> {
	render () {
		const { t } = this.props

		return (
			<div>
				<p>Specific MOS device settings.</p>
			</div>
		)
	}
}

class DeviceSettings extends React.Component<IPropsHeader & InjectedTranslateProps> {

	findHighestRank (array: Array<{ _rank: number }>): { _rank: number } | null {
		let max: { _rank: number } | null = null

		array.forEach((value, index) => {
			if (max == null || max._rank < value._rank) {
				max = value
			}
		})

		return max
	}

	renderSpecifics () {
		switch (this.props.device.type) {
			case PeripheralDeviceAPI.DeviceType.MOSDEVICE:
				return <MosDeviceSettings {...this.props} />
			case PeripheralDeviceAPI.DeviceType.PLAYOUT:
				return <PlayoutDeviceSettings {...this.props} />
			default:
				return null
		}
	}

	renderEditForm () {
		const { t } = this.props

		return (
			<div className='studio-edit mod mhl mvs'>
				<div>
					<h3>{t('Generic properties')}</h3>
					<label className='field'>
						{t('Device name')}
						<div className='mdi'>
							<EditAttribute
								modifiedClassName='bghl'
								attribute='name'
								obj={this.props.device}
								type='text'
								collection={PeripheralDevices}
								className='mdinput'></EditAttribute>
							<span className='mdfx'></span>
						</div>
					</label>

					{this.renderSpecifics()}
				</div>
			</div>
		)
	}

	render () {
		const { t } = this.props

		if (this.props.device) {
			return this.renderEditForm()
		} else {
			return <Spinner />
		}
	}
}

export default translate()(withTracker((props, state) => {
	return {
		device: PeripheralDevices.findOne(props.match.params.deviceId)
	}
})(DeviceSettings))
