import * as React from 'react'
import { getElementWidth } from '../../../utils/dimensions'
import * as _ from 'underscore'
import { RundownUtils } from '../../../lib/rundown'

import { PieceUi } from '../SegmentTimelineContainer'

import { FloatingInspector } from '../../FloatingInspector'

import ClassNames from 'classnames'
import { CustomLayerItemRenderer, ICustomLayerItemProps } from './CustomLayerItemRenderer'
import { VTSourceRendererBase } from './VTSourceRenderer'
import { MediaObject, Anomaly } from '../../../../lib/collections/MediaObjects'

import { Lottie } from '@crello/react-lottie'
// @ts-ignore Not recognized by Typescript
import * as loopAnimation from './icon-loop.json'
import { WithTranslation, withTranslation } from 'react-i18next'
import { LiveSpeakContent, VTContent } from '@sofie-automation/blueprints-integration'
import { RundownAPI } from '../../../../lib/api/rundown'
import { PieceStatusIcon } from '../PieceStatusIcon'
import { NoticeLevel, getNoticeLevelForPieceStatus } from '../../../lib/notifications/notifications'

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
