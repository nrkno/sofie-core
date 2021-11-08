import React from 'react'
import { PartExtended } from '../../../lib/Rundown'

interface IProps {
	part: PartExtended
}

export function StoryboardPart(props: IProps) {
	return <div className="segment-storyboard__part">{props.part.instance.part.title}</div>
}
