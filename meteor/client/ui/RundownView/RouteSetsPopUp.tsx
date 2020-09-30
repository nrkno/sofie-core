import * as React from 'react'
import { withTranslation } from 'react-i18next'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { StudioRouteSet, StudioRouteSetExclusivityGroup, StudioRouteBehavior } from '../../../lib/collections/Studios'
import classNames from 'classnames'

interface IProps {
	onStudioRouteSetSwitch?: (
		e: React.MouseEvent<HTMLElement>,
		routeSetId: string,
		routeSet: StudioRouteSet,
		state: boolean
	) => void
	availableRouteSets: [string, StudioRouteSet][]
	studioRouteSetExclusivityGroups: {
		[id: string]: StudioRouteSetExclusivityGroup
	}
}

export const RouteSetsPopUp = withTranslation()(
	class RouteSetsPopUp extends React.Component<Translated<IProps>> {
		render() {
			const { t } = this.props
			const exclusivityGroups: {
				[id: string]: Array<[string, StudioRouteSet]>
			} = {}
			for (let [id, routeSet] of this.props.availableRouteSets) {
				const group = routeSet.exclusivityGroup || '__noGroup'
				if (exclusivityGroups[group] === undefined) exclusivityGroups[group] = []
				exclusivityGroups[group].push([id, routeSet])
			}

			return (
				<div className="route-set-pop-up-panel">
					<div className="route-set-pop-up-panel__inside">
						<h2 className="mhn mvn">{t('Route Sets')}</h2>
						{Object.entries(exclusivityGroups).map(([key, routeSets]) => (
							<div className="route-set-pop-up-panel__group" key={key}>
								{this.props.studioRouteSetExclusivityGroups[key]?.name && (
									<p className="mhs mvs">{this.props.studioRouteSetExclusivityGroups[key]?.name}</p>
								)}
								{routeSets.length === 2 &&
								routeSets[0][1].behavior === StudioRouteBehavior.ACTIVATE_ONLY &&
								routeSets[1][1].behavior === StudioRouteBehavior.ACTIVATE_ONLY ? (
									<div key={routeSets[0][0]} className="route-set-pop-up-panel__group__controls mhm">
										<span
											className={classNames({
												'route-set-pop-up-panel__group__controls__active': routeSets[0][1].active,
												'route-set-pop-up-panel__group__controls__inactive': !routeSets[0][1].active,
											})}>
											{routeSets[0][1].name}
										</span>
										<a
											className={classNames('switch-button', {
												'sb-on': routeSets[1][1].active,
											})}
											role="button"
											onClick={(e) =>
												this.props.onStudioRouteSetSwitch &&
												this.props.onStudioRouteSetSwitch(
													e,
													routeSets[0][1].active ? routeSets[1][0] : routeSets[0][0],
													routeSets[0][1].active ? routeSets[1][1] : routeSets[0][1],
													true
												)
											}
											tabIndex={0}>
											<div className="sb-content">
												<div className="sb-label">
													<span className="mls">&nbsp;</span>
													<span className="mrs right">&nbsp;</span>
												</div>
												<div className="sb-switch"></div>
											</div>
										</a>
										<span
											className={classNames({
												'route-set-pop-up-panel__group__controls__active': routeSets[1][1].active,
												'route-set-pop-up-panel__group__controls__inactive': !routeSets[1][1].active,
											})}>
											{routeSets[1][1].name}
										</span>
									</div>
								) : (
									routeSets.map(([id, routeSet]) => (
										<div key={id} className="route-set-pop-up-panel__group__controls mhm">
											<span
												className={classNames({
													'route-set-pop-up-panel__group__controls__active': !routeSet.active,
													'route-set-pop-up-panel__group__controls__inactive': routeSet.active,
												})}>
												{t('Off')}
											</span>
											<a
												className={classNames('switch-button', {
													'sb-on': routeSet.active,
													'sb-disabled': routeSet.active && routeSet.behavior === StudioRouteBehavior.ACTIVATE_ONLY,
												})}
												role="button"
												onClick={(e) =>
													!(routeSet.active && routeSet.behavior === StudioRouteBehavior.ACTIVATE_ONLY) &&
													this.props.onStudioRouteSetSwitch &&
													this.props.onStudioRouteSetSwitch(e, id, routeSet, !routeSet.active)
												}
												tabIndex={0}>
												<div className="sb-content">
													<div className="sb-label">
														<span className="mls">&nbsp;</span>
														<span className="mrs right">&nbsp;</span>
													</div>
													<div className="sb-switch"></div>
												</div>
											</a>
											<span
												className={classNames({
													'route-set-pop-up-panel__group__controls__active': routeSet.active,
													'route-set-pop-up-panel__group__controls__inactive': !routeSet.active,
												})}>
												{routeSet.name}
											</span>
										</div>
									))
								)}
							</div>
						))}
					</div>
				</div>
			)
		}
	}
)
