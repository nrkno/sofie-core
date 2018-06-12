import * as React from 'react'
import { Translated } from '../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'

interface IProps {

}
export default translate()(class Dashboard extends React.Component<Translated<IProps>> {
	render () {
		const { t } = this.props

		return (
			<div>
				<div className='mtl gutter'>
					<h1>{t('Welcome to Sofie')}</h1>
				</div>
			</div>
		)
	}
})
