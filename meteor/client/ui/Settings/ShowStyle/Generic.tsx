import * as React from 'react'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { withTranslation } from 'react-i18next'
import { unprotectString } from '../../../../lib/lib'
import { EditAttribute } from '../../../lib/EditAttribute'
import { ShowStyleBase } from '../../../../lib/collections/ShowStyleBases'
import { Link } from 'react-router-dom'
import { Studio } from '../../../../lib/collections/Studios'
import { ShowStyleBases } from '../../../collections'

interface IShowStyleGenericPropertiesProps {
	showStyleBase: ShowStyleBase
	compatibleStudios: Array<Studio>
}
interface IShowStyleGenericPropertiesState {}
export const ShowStyleGenericProperties = withTranslation()(
	class StudioGenericProperties extends React.Component<
		Translated<IShowStyleGenericPropertiesProps>,
		IShowStyleGenericPropertiesState
	> {
		constructor(props: Translated<IShowStyleGenericPropertiesProps>) {
			super(props)
		}

		render(): JSX.Element {
			const { t, showStyleBase } = this.props

			return (
				<div>
					<div>
						<label className="field">
							{t('Show Style Base Name')}
							{!(this.props.showStyleBase && this.props.showStyleBase.name) ? (
								<div className="error-notice inline">
									<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No name set')}
								</div>
							) : null}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="name"
									obj={showStyleBase}
									type="text"
									collection={ShowStyleBases}
									className="mdinput"
								></EditAttribute>
								<span className="mdfx"></span>
							</div>
						</label>
					</div>
					<div>
						<p className="mod mhn mvs">{t('Compatible Studios:')}</p>
						<p className="mod mhn mvs">
							{this.props.compatibleStudios.length > 0
								? this.props.compatibleStudios.map((i) => (
										<span key={unprotectString(i._id)} className="pill">
											<Link className="pill-link" to={`/settings/studio/${i._id}`}>
												{i.name}
											</Link>
										</span>
								  ))
								: t('This Show Style is not compatible with any Studio')}
						</p>
					</div>
				</div>
			)
		}
	}
)
