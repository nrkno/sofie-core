import * as React from 'react'

import { translateWithTracker, Translated } from './ReactMeteorData/ReactMeteorData'
import { CoreSystem, ICoreSystem } from '../../lib/collections/CoreSystem'

import { ReactiveVar } from 'meteor/reactive-var'

export const documentTitle = new ReactiveVar<null | string>(null)

interface IProps {}

interface ITrackedProps {
	cs: ICoreSystem | undefined
	doc: string | null
}

export const DocumentTitleProvider = translateWithTracker((props: IProps) => {
	return {
		cs: CoreSystem.findOne(),
		doc: documentTitle.get(),
	}
})(
	class DocumentTitleProvider extends React.Component<Translated<IProps & ITrackedProps>, {}> {
		private formatDocumentTitle(docTitle: string | undefined, csName: string | undefined) {
			const { t } = this.props
			const appShortName = t('Sofie')
			let compiledTitle = appShortName
			if (docTitle && csName) {
				compiledTitle = t('{{docTitle}} - {{appShortName}} - {{systemName}}', {
					docTitle,
					appShortName,
					systemName: csName,
				})
			} else if (docTitle && !csName) {
				compiledTitle = t('{{docTitle}} - {{appShortName}}', {
					docTitle,
					appShortName,
				})
			} else if (csName && !docTitle) {
				compiledTitle = t('{{appShortName}} - {{systemName}}', {
					appShortName,
					systemName: csName,
				})
			}

			document.title = compiledTitle
		}

		componentDidMount() {
			const { doc, cs } = this.props
			this.formatDocumentTitle(doc || undefined, cs?.name)
		}

		componentDidUpdate() {
			const { doc, cs } = this.props
			this.formatDocumentTitle(doc || undefined, cs?.name)
		}

		componentWillUnmount() {
			this.formatDocumentTitle(undefined, undefined)
		}

		render() {
			return null
		}
	}
)
