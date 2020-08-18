import { withTranslation } from 'react-i18next'
import { VTSourceRendererBase } from './VTSourceRenderer'

export const STKSourceRenderer = withTranslation()(
	class STKSourceRenderer extends VTSourceRendererBase {
		constructor(props) {
			super(props)
		}

		render() {
			return super.render()
		}
	}
)
