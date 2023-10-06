export enum PieceLifespan {
	/** The Piece will only exist in it's designated Part. As soon as the playhead leaves the Part, the Piece will stop */
	WithinPart = 'part-only',
	/** The Piece will only exist in it's designated Segment. It will begin playing when taken and will stop when the
	 * playhead leaves the Segment */
	OutOnSegmentChange = 'segment-change',
	/** The Piece will only exist in it's designated Segment. It will begin playing when taken and will stop when the
	 * playhead leaves the Segment or the playhead moves before the beginning of the Piece */
	OutOnSegmentEnd = 'segment-end',
	/** The Piece will only exist in it's designated Rundown. It will begin playing when taken and will stop when the
	 * playhead leaves the Rundown */
	OutOnRundownChange = 'rundown-change',
	/** The Piece will only exist in it's designated Rundown. It will begin playing when taken and will stop when the
	 * playhead leaves the Rundown or the playhead moves before the beginning of the Piece */
	OutOnRundownEnd = 'rundown-end',
	/** The Piece will only exist while the ShowStyle doesn't change. It will begin playing when taken and will stop
	 * when the playhead leaves the Rundown into a new Rundown with a different ShowStyle */
	OutOnShowStyleEnd = 'showstyle-end',
}
