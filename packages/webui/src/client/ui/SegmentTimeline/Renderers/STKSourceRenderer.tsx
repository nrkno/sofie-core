import { VTSourceRendererBase } from './VTSourceRenderer'
import { withTranslation } from 'react-i18next'

export const STKSourceRenderer = withTranslation()(
	class STKSourceRenderer extends VTSourceRendererBase {
		render(): JSX.Element {
			return super.render()
		}
	}
)
