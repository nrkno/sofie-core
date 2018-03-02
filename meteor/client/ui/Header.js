import React, { Component } 	from 'react';
import { Link } from 'react-router-dom'

export default class Header extends Component {
	render() {
		return (
			<div className="header row">
				<div className="col c6 dark">
					<div className="mod">
						<img className="media-elem mrs" src="origo-ui/images/nrk.svg" width="58" />
						<div className="bd mls"><span className="logo-text">YASS</span></div>
					</div>
				</div>
				<div className="col c6 dark">
					<div className="links mod">
						<Link to="/">Home</Link>
						<Link to="/tasks">Tasks</Link>
						<Link to="/nymansPlayground">Nyman's Playground</Link>
					</div>
				</div>
			</div>
		);
	}
};
