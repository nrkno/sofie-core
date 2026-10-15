import type { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import './MultiviewScreen.scss'

interface MultiviewScreenProps {
	studioId: StudioId
}

export function MultiviewScreen({ studioId }: Readonly<MultiviewScreenProps>): JSX.Element {
	return (
		<div className="multiview-grid">
			<div className="multiview-item multiview-presenter">
				<iframe src={`/studio/${studioId}/presenter`} title="Presenter Screen" />
				<div className="multiview-label">Presenter Screen</div>
			</div>
			<div className="multiview-item multiview-director">
				<iframe src={`/studio/${studioId}/director`} title="Director Screen" />
				<div className="multiview-label">Director Screen</div>
			</div>
			<div className="multiview-item multiview-prompter">
				<iframe src={`/studio/${studioId}/prompter`} title="Prompter" />
				<div className="multiview-label">Prompter</div>
			</div>
			<div className="multiview-item multiview-overlay">
				<iframe src={`/studio/${studioId}/overlay`} title="Overlay Screen" />
				<div className="multiview-label">Overlay Screen</div>
			</div>
			<div className="multiview-item multiview-camera">
				<iframe src={`/studio/${studioId}/camera`} title="Camera Screen" />
				<div className="multiview-label">Camera Screen</div>
			</div>
		</div>
	)
}
