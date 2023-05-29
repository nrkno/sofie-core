import * as React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { unprotectString } from '../../../../lib/lib'
import { EditAttribute } from '../../../lib/EditAttribute'
import { ShowStyleBase } from '../../../../lib/collections/ShowStyleBases'
import { Link } from 'react-router-dom'
import { Studio } from '../../../../lib/collections/Studios'
import { ShowStyleBases } from '../../../collections'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides'

interface IShowStyleGenericPropertiesProps {
	showStyleBase: ShowStyleBase
	compatibleStudios: Array<Studio>
}
export function ShowStyleGenericProperties({
	showStyleBase,
	compatibleStudios,
}: IShowStyleGenericPropertiesProps): JSX.Element {
	const { t } = useTranslation()

	return (
		<div>
			<div>
				<label className="field">
					<LabelActual label={t('Show Style Base Name')} />
					{!(showStyleBase && showStyleBase.name) ? (
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
					{compatibleStudios.length > 0
						? compatibleStudios.map((i) => (
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
