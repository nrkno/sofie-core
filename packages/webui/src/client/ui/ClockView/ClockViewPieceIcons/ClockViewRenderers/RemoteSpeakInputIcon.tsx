export function RemoteSpeakInputIcon({ abbreviation }: { abbreviation?: string }): JSX.Element {
	return (
		<div className="clock-view-piece-icon">
			<rect width="126.5" height="89" className="remote-speak" />
			<linearGradient id="background-gradient" gradientTransform="rotate(90)">
				<stop className="stop1" offset={0.5} />
				<stop className="stop2" offset={0.5} />
			</linearGradient>
			<span className="remote-speak">{abbreviation !== undefined ? abbreviation : 'RSK'}</span>
		</div>
	)
}
