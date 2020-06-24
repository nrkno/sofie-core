import * as React from 'react'
import * as PropTypes from 'prop-types'
import { withTranslation } from 'react-i18next'

import ClassNames from 'classnames'
import * as _ from 'underscore'
import { ContextMenuTrigger } from 'react-contextmenu'

import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Rundown, RundownHoldState } from '../../../lib/collections/Rundowns'
import { Studio } from '../../../lib/collections/Studios'
import { SegmentUi, PartUi, IOutputLayerUi, PieceUi } from './SegmentTimelineContainer'
import { TimelineGrid } from './TimelineGrid'
import { SegmentTimelinePart } from './SegmentTimelinePart'
import { SegmentTimelineZoomControls } from './SegmentTimelineZoomControls'
import { SegmentDuration, PartCountdown, RundownTiming, CurrentPartRemaining } from '../RundownView/RundownTiming'

import { RundownUtils } from '../../lib/rundown'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import { scrollToSegment, scrollToPart } from '../../lib/viewPort'

interface IProps {
	key: string
	rundown: Rundown
}
interface IState {}
export class RundownTimeline extends React.Component<IProps, IState> {
	constructor(props, context) {
		super(props, context)
		this.state = {}
	}

	render() {
		return (
			<div className="rundown-divider-timeline">
				<h2 className="rundown-divider-timeline__title">{this.props.rundown.name}</h2>
			</div>
		)
	}
}
