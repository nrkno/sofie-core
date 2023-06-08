import type { SystemBlueprintManifest } from './system'
import type { StudioBlueprintManifest } from './studio'
import type { ShowStyleBlueprintManifest } from './showStyle'

export * from './base'
export * from './showStyle'
export * from './studio'
export * from './system'

export interface BlueprintManifestSet {
	blueprints: {
		[id: string]: string
	}
	assets: {
		[id: string]: string
	}
}
export type SomeBlueprintManifest = SystemBlueprintManifest | StudioBlueprintManifest | ShowStyleBlueprintManifest
