import * as React from 'react'

interface IProps {
	children: JSX.Element[]
}
export function NotLoggedInContainer(props: Readonly<IProps>): JSX.Element {
	return (
		<div className="center-page">
			<div className="mtl gutter flex-col page">
				<header className="mvs alc header">
					<div className="badge">
						<div className="sofie-logo"></div>
					</div>
					<h1>{'Sofie - TV Automation System'}</h1>
				</header>
				<div className="container">{props.children}</div>
			</div>
		</div>
	)
}
