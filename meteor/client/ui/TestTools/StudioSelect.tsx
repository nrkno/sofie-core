import React from 'react'
import { useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Link } from 'react-router-dom'
import { unprotectString } from '../../../lib/lib'
import { UIStudios } from '../Collections'
import { useTranslation } from 'react-i18next'
import { UIStudio } from '../../../lib/api/studios'

function StudioSelect({ title, path }: { title: string; path: string }): JSX.Element {
	const studios = useTracker(
		() =>
			UIStudios.find(
				{},
				{
					sort: {
						_id: 1,
					},
				}
			).fetch(),
		[],
		[] as UIStudio[]
	)

	const { t } = useTranslation()

	return (
		<div className="mhl gutter recordings-studio-select">
			<header className="mbs">
				<h1>{t(title)}</h1>
			</header>
			<div className="mod mvl">
				<strong>Studio</strong>
				<ul>
					{studios.map((studio) => {
						return (
							<li key={unprotectString(studio._id)}>
								<Link to={`${path}/${studio._id}`}>{studio.name}</Link>
							</li>
						)
					})}
				</ul>
			</div>
		</div>
	)
}

export { StudioSelect }
