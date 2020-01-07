import * as React from 'react';
import * as _ from 'underscore';
import { Redirect } from 'react-router';
import { withTracker } from './ReactMeteorData/ReactMeteorData';
import { Mongo } from 'meteor/mongo';
import { translate } from 'react-i18next';
import { callMethod } from './clientAPI';
import { Blueprints } from '../../lib/collections/Blueprints';
import { BlueprintAPI } from '../../lib/api/blueprint';
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases';
import { ShowStylesAPI } from '../../lib/api/showStyles';
import { Studios } from '../../lib/collections/Studios';

interface ISettingsNavigation extends ISettingsNavigationBaseProps {
	type: SettingsNavigationType;
}
export type SettingsNavigationType = 'blueprint' | 'showstyle' | 'newshowstyle';
export class SettingsNavigation extends React.Component<ISettingsNavigation> {
	render() {
		if (this.props.type === 'blueprint') {
			return <Blueprint {...this.props} />;
		} else if (this.props.type === 'showstyle') {
			return <ShowStyle {...this.props} />;
		} else if (this.props.type === 'newshowstyle') {
			return <NewShowStyle {...this.props} />;
		}

		return <div>Unknown edit type {this.props.type}</div>;
	}
}
interface ISettingsNavigationBaseProps {
	attribute?: string;
	collection?: Mongo.Collection<any>;
	obj?: any;
	className?: string;
}

interface ISettingsNavigationBaseState {
	redirect: boolean;
	redirectRoute: string;
}
export class SettingsNavigationBase extends React.Component<
	ISettingsNavigationBaseProps,
	ISettingsNavigationBaseState
> {
	constructor(props) {
		super(props);

		this.state = {
			redirect: false,
			redirectRoute: ''
		};

		this.redirectUser = this.redirectUser.bind(this);
	}

	redirectUser(url: string) {
		this.setState({
			redirect: true,
			redirectRoute: url
		});
	}

	renderButton() {
		return <button></button>;
	}

	render() {
		if (this.state.redirect === true) {
			return <Redirect to={this.state.redirectRoute} />;
		}

		return this.renderButton();
	}
}
function wrapSettingsNavigation(newClass) {
	return withTracker((props: ISettingsNavigationBaseProps) => {
		// These properties will be exposed under this.props
		// Note that these properties are reactively recalculated
		return {
			myObject: props.collection
				? props.collection.findOne(props.obj._id)
				: props.obj || {}
		};
	})(newClass);
}

const Blueprint = wrapSettingsNavigation(
	translate()(
		class extends SettingsNavigationBase {
			constructor(props) {
				super(props);
			}

			onBlueprintAdd() {
				let before = Blueprints.find({}).fetch();
				callMethod('Menu', BlueprintAPI.methods.insertBlueprint);
				setTimeout(() => {
					let after = Blueprints.find({}).fetch();
					let newBlueprint = _.difference(
						after.map((a) => a._id),
						before.map((b) => b._id)
					)[0];
					this.props.obj['blueprintId'] = newBlueprint;
					if (this.props.obj) {
						let m = {};
						m['blueprintId'] = newBlueprint;
						Studios.update(this.props.obj['_id'], { $set: m });
					}
					this.redirectUser('/settings/blueprint/' + newBlueprint);
				}, 1000);
			}

			renderButton() {
				if (this.props.obj && this.props.attribute) {
					if (this.props.obj[this.props.attribute]) {
						return (
							<button
								className="btn btn-primary btn-add-new"
								onClick={(e) => {
									this.redirectUser(
										'/settings/blueprint/' +
											(this.props.attribute
												? this.props.obj[this.props.attribute]
												: '')
									);
								}}>
								Edit Blueprint
							</button>
						);
					}
				}

				return (
					<button
						className="btn btn-primary btn-add-new"
						onClick={(e) => {
							this.onBlueprintAdd();
						}}>
						New Blueprint
					</button>
				);
			}
		}
	)
);

const ShowStyle = wrapSettingsNavigation(
	translate()(
		class extends SettingsNavigationBase {
			constructor(props) {
				super(props);
			}

			onShowStyleAdd() {
				let before = ShowStyleBases.find({}).fetch();
				callMethod('Menu', ShowStylesAPI.methods.insertShowStyleBase);
				setTimeout(() => {
					let after = ShowStyleBases.find({}).fetch();
					let newShowStyle = _.difference(
						after.map((a) => a._id),
						before.map((b) => b._id)
					)[0];
					this.redirectUser('/settings/showStyleBase/' + newShowStyle);
				}, 1000);
			}

			renderButton() {
				if (this.props.obj && this.props.attribute) {
					return (
						<button
							key={'button-navigate-' + this.props.obj[this.props.attribute]}
							className="btn btn-primary btn-add-new"
							onClick={(e) => {
								this.redirectUser(
									'/settings/showStyleBase/' +
										(this.props.attribute ? this.props.obj['_id'] : '')
								);
							}}>
							Edit {this.props.obj[this.props.attribute]}
						</button>
					);
				}
				return <div>Invalid props for SettingsNavigation</div>;
			}
		}
	)
);

const NewShowStyle = wrapSettingsNavigation(
	translate()(
		class extends SettingsNavigationBase {
			constructor(props) {
				super(props);
			}

			onShowStyleAdd() {
				let before = ShowStyleBases.find({}).fetch();
				callMethod('Menu', ShowStylesAPI.methods.insertShowStyleBase);
				setTimeout(() => {
					let after = ShowStyleBases.find({}).fetch();
					let newShowStyle = _.difference(
						after.map((a) => a._id),
						before.map((b) => b._id)
					)[0];
					this.redirectUser('/settings/showStyleBase/' + newShowStyle);
				}, 1000);
			}

			renderButton() {
				return (
					<button
						className="btn btn-primary btn-add-new"
						onClick={(e) => {
							this.onShowStyleAdd();
						}}>
						New Show Style
					</button>
				);
			}
		}
	)
);
