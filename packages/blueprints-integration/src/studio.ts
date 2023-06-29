import { Mapping, Mappings } from 'timeline-state-resolver-types'

export enum LookaheadMode {
	/**
	 * Disable lookahead for this layer
	 */
	NONE = 0,
	/**
	 * Preload content with a secondary layer.
	 * This requires support from the TSR device, to allow for preloading on a resource at the same time as it being on air.
	 * For example, this allows for your TimelineObjects to control the foreground of a CasparCG layer, with lookahead controlling the background of the same layer.
	 */
	PRELOAD = 1,
	// RETAIN = 2, // Removed due to complexity and it being possible to emulate with WHEN_CLEAR and infinites
	/**
	 * Fill the gaps between the planned objects on a layer.
	 * This is the primary lookahead mode, and appears to TSR devices as a single layer of simple objects.
	 */
	WHEN_CLEAR = 3,
}

export interface BlueprintMappings extends Mappings {
	[layerName: string]: BlueprintMapping
}
export interface BlueprintMapping extends Mapping {
	/** What method core should use to create lookahead objects for this layer */
	lookahead: LookaheadMode
	/** The minimum number lookahead objects to create from future parts for this layer. Default = 1 */
	lookaheadDepth?: number
	/** Maximum distance to search for lookahead. Default = undefined */
	lookaheadMaxSearchDistance?: number
}
