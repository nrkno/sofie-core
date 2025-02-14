import { useCallback, useEffect, useRef } from 'react'

interface IFramePreviewProps {
	content: { type: 'iframe'; href: string; awaitMessage?: any; postMessage?: any }
	time: number | null
}

export function IFramePreview({ content }: IFramePreviewProps): React.ReactElement {
	const iFrameElement = useRef<HTMLIFrameElement>(null)

	const onLoadListener = useCallback(() => {
		console.log('send', content.postMessage)
		if (content.postMessage) {
			iFrameElement.current?.contentWindow?.postMessage(content.postMessage)
		}
	}, [])

	useEffect(() => {
		if (!iFrameElement) return

		iFrameElement.current?.addEventListener('load', onLoadListener)

		return () => iFrameElement.current?.removeEventListener('load', onLoadListener)
	}, [iFrameElement.current, onLoadListener])

	return (
		<div className="preview-popUp__iframe">
			<div className="preview">
				<img src="/images/previewBG.jpg" alt="" />
				{content.href && (
					<iframe
						key={content.href} // Use the url as the key, so that the old renderer unloads immediately when changing url
						sandbox="allow-scripts allow-same-origin"
						src={content.href}
						ref={iFrameElement}
					></iframe>
				)}
			</div>
		</div>
	)
}
