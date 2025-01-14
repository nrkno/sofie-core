import React from 'react'
import { PreviewContent } from './PreviewPopUpContext'

interface PreviewPopUpContentProps {
	content: PreviewContent
}

export function PreviewPopUpContent({ content }: PreviewPopUpContentProps): React.ReactElement {
	switch (content.type) {
		case 'text':
			return <ScriptPreviewElement content={content} />
		default:
			return <></>
	}
}

interface ScriptPreviewProps {
	content: {
		type: 'text'
		content: string
	}
}
export function ScriptPreviewElement({ content }: ScriptPreviewProps): React.ReactElement {
	return <div className="script">{content.content}</div>
}
