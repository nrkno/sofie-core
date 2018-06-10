// Note: This file only contains typings exported from the casparcg-state library
import {
	TransitionObject as TransitionObject0,
	Transition as Transition0
} from './transitionObject'
import { Mixer as Mixer0 } from './mixer'

export namespace CasparCG {
	export class Mappings {
		layers: {[GLayer: string]: Mapping} = {}
	}
	export class Mapping {
		channel: number
		layer: number
	}
	export class State {
		channels: { [channel: string]: Channel} = {}
	}
	export class ChannelInfo {
		videoMode?: string | null
		fps?: number
	}
	export class Channel extends ChannelInfo {
		channelNo: number
		layers: { [layer: string]: ILayerBase} = {}
	}
	export class ILayerBase {
		layerNo: number
		content: LayerContentType // string | null 		// @todo: enum?
		media?: string | TransitionObject0 | null // clip or templatename
		looping?: boolean
		playTime?: number | null // timestamp when content started playing, (null == 'irrelevant')
		duration?: number
		noClear?: boolean
		playing?: boolean
		mixer?: Mixer0
	}
	export class NextUp extends ILayerBase {
		auto: boolean
	}
	export interface IMediaLayer extends ILayerBase {
		content: LayerContentType.MEDIA
		media: string | TransitionObject0 | null // clip name
		playTime: number | null
		playing: boolean

		looping?: boolean
		seek?: number
		pauseTime?: number | null

		nextUp?: NextUp | null
	}
	export interface ITemplateLayer extends ILayerBase {
		content: LayerContentType.TEMPLATE
		media: string | TransitionObject0 | null // template name
		playTime: number | null
		playing: boolean

		templateType?: 'flash' | 'html'	// @todo: string literal 'flash', 'html'
		templateFcn?: string // 'play', 'update', 'stop' or else (invoke)
		templateData?: Object | string | null
		cgStop?: boolean

		nextUp?: NextUp | null
	}
	export interface IHtmlPageLayer extends ILayerBase {
		content: LayerContentType.HTMLPAGE
		media: string | TransitionObject0 | null // template name
		playTime: number | null
		playing: true

		nextUp?: NextUp | null
	}
	export interface IInputLayer extends ILayerBase {
		content: LayerContentType.INPUT
		media: 'decklink' | TransitionObject0
		input: {
			device: number,
			format?: string,
			channelLayout?: string
		}
		playing: true,
		playTime: null
	}
	export interface IRouteLayer extends ILayerBase {
		content: LayerContentType.ROUTE
		media: 'route' | TransitionObject0
		route: {
			channel: number,
			layer?: number | null
		} | null
		playing: true
		playTime: null
	}
	export interface IRecordLayer extends ILayerBase {
		content: LayerContentType.RECORD
		encoderOptions: string
		playing: true
		playTime: number
	}
	export interface IFunctionLayer extends ILayerBase {
		content: LayerContentType.FUNCTION
		executeFcn?: string // name of function to execute
		executeData?: any
		oscDevice?: number
		inMessage?: {
			url: string,
			args?: {}
		} | null
		outMessage?: {
			url: string,
			args?: {}
		} | null
	}
	export interface IEmptyLayer extends ILayerBase {
		content: LayerContentType.NOTHING,
		playing: false
		pauseTime: 0
		nextUp?: NextUp | null
		templateData?: Object | null,
		encoderOptions?: string
	}
	export enum LayerContentType {
		NOTHING = '',
		MEDIA = 'media',
		TEMPLATE = 'template',
		HTMLPAGE = 'htmlpage',
		INPUT = 'input',
		ROUTE = 'route',
		RECORD = 'record',
		FUNCTION = 'function'

	}
	export interface Mixer extends Mixer0 {}
	export interface ITransition {

		type?: string
		duration: number
		easing?: string
		direction?: string

	}
	export interface TransitionObject extends TransitionObject0 {}
	export interface Transition extends Transition0 {}
}
