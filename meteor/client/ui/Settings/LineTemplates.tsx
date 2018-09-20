import * as React from 'react'
import { RuntimeFunction, RuntimeFunctions } from '../../../lib/collections/RuntimeFunctions'
import { EditAttribute, EditAttributeBase } from '../../lib/EditAttribute'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
// import * as monaco from 'monaco-editor' // instead globally available through public folder
// import MonacoEditor from 'react-monaco-editor'
import '../../../lib/typings/monaco'
import * as _ from 'underscore'
import { Session } from 'meteor/session'
import { ClientAPI } from '../../../lib/api/client'
import { RuntimeFunctionsAPI } from '../../../lib/api/runtimeFunctions'
import { RuntimeFunctionDebugDataObj, RuntimeFunctionDebugData } from '../../../lib/collections/RuntimeFunctionDebugData'
import Moment from 'react-moment'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import * as ClassNames from 'classnames'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faSave from '@fortawesome/fontawesome-free-solid/faSave'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { MomentFromNow } from '../../lib/Moment'
import { eventContextForLog } from '../../lib/eventTargetLogHelper';

interface IMonacoProps {
	runtimeFunction: RuntimeFunction
	functionTyping: any[] | null
}
interface IMonacoState {
	unsavedChanges: boolean
	saving: boolean
	message: string

}
class MonacoWrapper extends React.Component<IMonacoProps, IMonacoState> {
	static _monacoRequire: any
	static _requireBuffer: any
	static _monacoRef: any
	static _processPlatform: string

	_container: HTMLDivElement
	_editor: monaco.editor.IStandaloneCodeEditor
	_editorEventListeners: monaco.IDisposable[] = []
	_codeId: string
	private _saveTimeout: any
	private _testTimeout: any
	private _currentCode: string

	constructor (props) {
		super(props)

		this.state = {
			unsavedChanges: false,
			saving: false,
			message: ''
		}
	}

	componentDidUpdate () {
		if (this._editor) {
			this.attachEditor()
		}
	}

	attachEditor = () => {
		// Extra libraries
		let libName = 'tmp.d.ts'
		if (!monaco.languages.typescript.javascriptDefaults['_extraLibs'][libName]) {
			monaco.languages.typescript.javascriptDefaults.addExtraLib(`
declare enum IMOSObjectStatus {
	NEW = "NEW",
	UPDATED = "UPDATED",
	MOVED = "MOVED",
	BUSY = "BUSY",
	DELETED = "DELETED",
	NCS_CTRL = "NCS CTRL",
	MANUAL_CTRL = "MANUAL CTRL",
	READY = "READY",
	NOT_READY = "NOT READY",
	PLAY = "PLAY",
	STOP = "STOP",
}
declare enum IMOSObjectAirStatus {
	READY = "READY",
	NOT_READY = "NOT READY",
}
declare enum IMOSObjectAirStatus {
    READY = "READY",
    NOT_READY = "NOT READY",
}
declare interface IMOSObjectPath {
    Type: IMOSObjectPathType;
    Description: string;
    Target: string;
}
declare declare enum IMOSObjectPathType {
    PATH = "PATH",
    PROXY_PATH = "PROXY PATH",
    METADATA_PATH = "METADATA PATH",
}
declare type Time = number
declare interface DBRunningOrder {
	_id: string
	/** ID of the object in MOS */
	mosId: string
	studioInstallationId: string
	showStyleId: string
	/** the mos device the rundown originates from */
	mosDeviceId: string
	/** Rundown slug - user-presentable name */
	name: string
	created: Time
	modified: Time

	/** Expected start should be set to the expected time this running order should run on air. Should be set to EditorialStart from IMOSRunningOrder */
	expectedStart?: Time
	/** Expected duration of the running order - should be set to EditorialDuration from IMOSRunningOrder */
	expectedDuration?: number

	metaData?: Array<IMOSExternalMetaData>
	status?: IMOSObjectStatus
	airStatus?: IMOSObjectAirStatus
	// There should be something like a Owner user here somewhere?
	active?: boolean
	/** the id of the Live Segment Line - if empty, no segment line in this rundown is live */
	currentSegmentLineId: string | null
	/** the id of the Next Segment Line - if empty, no segment will follow Live Segment Line */
	nextSegmentLineId: string | null
	/** the id of the Previous Segment Line - cleared once playback of the currentSegmentLine has been confirmed by TSR */
	previousSegmentLineId: string | null

	/** Actual time of playback starting */
	startedPlayback?: Time
}
declare interface IMOSExternalMetaData {
	MosScope?: IMOSScope;
	MosSchema: string;
	MosPayload: any;
}
declare enum IMOSScope {
	OBJECT = "OBJECT",
	STORY = "STORY",
	PLAYLIST = "PLAYLIST",
}
declare interface MosExternalMetaData {
	private _scope?;
	private _schema;
	private _payload;
	constructor(obj: IMOSExternalMetaData);
	readonly scope: IMOSScope | undefined;
	readonly schema: string;
	readonly payload: any;
	readonly messageXMLBlocks: any
}
declare interface DBSegmentLine {
	/** ID of the SegmentLine*/
	_id: string
	/** Position inside the segment */
	_rank: number
	/** ID of the source object in MOS */
	mosId: string
	/** The segment ("Title") this line belongs to */
	segmentId: string
	/** The running order this line belongs to */
	runningOrderId: string
	/** The story Slug (like a title, but slimier) */
	slug: string
	/** Should this item should progress to the next automatically */
	autoNext?: boolean
	/** How much to overlap on when doing autonext */
	autoNextOverlap?: number
	overlapDuration?: number
	transitionDelay?: string
	transitionDuration?: number
	/** Should we block a transition at the out of this SegmentLine */
	disableOutTransition?: boolean

	metaData?: Array<IMOSExternalMetaData>
	// status?: IMOSObjectStatus

	/** Expected duration of the line, in milliseconds */
	expectedDuration?: number

	/** The time the system started playback of this segment line, null if not yet played back (milliseconds since epoch) */
	startedPlayback?: number
	/** The time the system played back this segment line, null if not yet finished playing, in milliseconds */
	duration?: number
	/** If the item is overflowing, it's expectedDuration will overflow to the adjacent segment line */
	overflows?: boolean

	/** Whether this segment line supports being used in HOLD */
	holdMode?: SegmentLineHoldMode
}
declare type SegmentLine = DBSegmentLine
declare enum LayerType {
	Source,
	Output,
	LLayer,
}
declare interface Context {
	runningOrderId: string
	segmentLine: SegmentLine

	getHashId: (stringToBeHashed?: string | number) => string
	unhashId: (hash: string) => string
	getLayer: (type: LayerType, key: string) => string
	getConfigValue: (key: string, defaultValue?: any) => any
	getValueByPath: (sourceObject: object | undefined, pathToAttributeInObject: string, defaultValue?: any) => any
	iterateDeeply: (obj: any, iteratee: (val: any, key?: string | number) => (any | iterateDeeplyEnum), key?: string | number) => any
	getHelper: (functionId: string) => Function
	runHelper: (functionId: string, ...args: any[]) => any
	error: (message: string) => void
	warning: (message: string) => void
	getSegmentLines: () => Array<SegmentLine>
	getSegmentLineIndex: () => number
	formatDateAsTimecode: (date: Date) => string
	formatDurationAsTimecode: (time: number) => string
	getNotes: () => Array<any>
	getCachedStoryForSegmentLine (segmentLine: SegmentLine): IMOSROFullStory
	getCachedStoryForRunningOrder: () => IMOSRunningOrder
	getAllSegmentLines (): Array<SegmentLine>
}
type MosString128 = string
type Duration = number
declare interface IMOSItem {
    ID: MosString128;
    Slug?: MosString128;
    ObjectID: MosString128;
    MOSID: string;
    mosAbstract?: string;
    Paths?: Array<IMOSObjectPath>;
    Channel?: MosString128;
    EditorialStart?: number;
    EditorialDuration?: number;
    UserTimingDuration?: number;
    Trigger?: any;
    MacroIn?: MosString128;
    MacroOut?: MosString128;
    MosExternalMetaData?: Array<IMOSExternalMetaData>;
    MosObjects?: Array<IMOSObject>;
}
declare interface IMOSROFullStoryBodyItem {
    Type: string;
    Content: any | IMOSItem;
}
declare interface IMOSROFullStory extends IMOSStory {
    RunningOrderId: MosString128;
    Body: Array<IMOSROFullStoryBodyItem>;
}
declare type Story = IMOSROFullStory

declare enum TriggerType {
    TIME_ABSOLUTE = 0,
    TIME_RELATIVE = 1,
    LOGICAL = 3
}

declare type TimelineContentTypeAny =
	TimelineContentTypeOther |
	TimelineContentTypeCasparCg |
	TimelineContentTypeLawo |
	TimelineContentTypeAtem |
	TimelineContentTypeHttp

declare enum TimelineContentTypeOther {
	NOTHING = 'nothing',
	GROUP = 'group',
}
declare enum TimelineContentTypeCasparCg { //  CasparCG-state/TSR
	VIDEO = 'video', // later to be deprecated & replaced by MEDIA
	AUDIO = 'audio', // later to be deprecated & replaced by MEDIA
	MEDIA = 'media',
	IP = 'ip',
	INPUT = 'input',
	TEMPLATE = 'template',
	HTMLPAGE = 'htmlpage',
	ROUTE = 'route',
	RECORD = 'record'
}
declare enum TimelineContentTypeLawo { // lawo-state
	SOURCE = 'lawosource'
}
declare enum TimelineContentTypeAtem { //  Atem-state
	ME = 'me',
	DSK = 'dsk',
	AUX = 'aux',
	SSRC = 'ssrc',
	SSRCPROPS = 'ssrcProps',
	MEDIAPLAYER = 'mp'
}
declare enum TimelineContentTypeHttp {
	POST = 'post',
	PUT = 'put',
}
declare namespace Atem_Enums {
	declare enum TransitionStyle {
		MIX = 0,
		DIP = 1,
		WIPE = 2,
		DVE = 3,
		STING = 4,
		CUT = 5,
	}

	declare enum SourceIndex {
		Blk = 0,
		Bars = 1000,
		Col1 = 2001,
		Col2 = 2002,
		MP1 = 3010,
		MP1K = 3011,
		MP2 = 3020,
		MP2K = 3021,
		SSrc = 6000,
		Cfd1 = 7001,
		Cfd2 = 7002,
		Aux1 = 8001,
		Aux2 = 8002,
		Aux3 = 8003,
		Aux4 = 8004,
		Aux5 = 8005,
		Aux6 = 8006,
		Prg1 = 10010,
		Prv1 = 10011,
		Prg2 = 10020,
		Prv2 = 10021
	}
}
declare enum EmberPlusValueType {
	REAL 	= 'real',
	INT 	= 'int',
	BOOLEAN = 'boolean',
	STRING 	= 'string'
}
declare enum Transition {
	MIX = 'MIX',
	CUT = 'CUT',
	PUSH = 'PUSH',
	WIPE = 'WIPE',
	SLIDE = 'SLIDE'
}

declare enum Ease {
	LINEAR = 'LINEAR',
	NONE = 'NONE',
	EASEINBACK = 'EASEINBACK',
	EASEINBOUNCE = 'EASEINBOUNCE',
	EASEINCIRC = 'EASEINCIRC',
	EASEINCUBIC = 'EASEINCUBIC',
	EASEINELASTIC = 'EASEINELASTIC',
	EASEINEXPO = 'EASEINEXPO',
	EASEINOUTBACK = 'EASEINOUTBACK',
	EASEINOUTBOUNCE = 'EASEINOUTBOUNCE',
	EASEINOUTCIRC = 'EASEINOUTCIRC',
	EASEINOUTCUBIC = 'EASEINOUTCUBIC',
	EASEINOUTELASTIC = 'EASEINOUTELASTIC',
	EASEINOUTEXPO = 'EASEINOUTEXPO',
	EASEINOUTQUAD = 'EASEINOUTQUAD',
	EASEINOUTQUART = 'EASEINOUTQUART',
	EASEINOUTQUINT = 'EASEINOUTQUINT',
	EASEINOUTSINE = 'EASEINOUTSINE',
	EASEINQUAD = 'EASEINQUAD',
	EASEINQUART = 'EASEINQUART',
	EASEINQUINT = 'EASEINQUINT',
	EASEINSINE = 'EASEINSINE',
	EASELINEAR = 'EASELINEAR',
	EASENONE = 'EASENONE',
	EASEOUTBACK = 'EASEOUTBACK',
	EASEOUTBOUNCE = 'EASEOUTBOUNCE',
	EASEOUTCIRC = 'EASEOUTCIRC',
	EASEOUTCUBIC = 'EASEOUTCUBIC',
	EASEOUTELASTIC = 'EASEOUTELASTIC',
	EASEOUTEXPO = 'EASEOUTEXPO',
	EASEOUTINBACK = 'EASEOUTINBACK',
	EASEOUTINBOUNCE = 'EASEOUTINBOUNCE',
	EASEOUTINCIRC = 'EASEOUTINCIRC',
	EASEOUTINCUBIC = 'EASEOUTINCUBIC',
	EASEOUTINELASTIC = 'EASEOUTINELASTIC',
	EASEOUTINEXPO = 'EASEOUTINEXPO',
	EASEOUTINQUAD = 'EASEOUTINQUAD',
	EASEOUTINQUART = 'EASEOUTINQUART',
	EASEOUTINQUINT = 'EASEOUTINQUINT',
	EASEOUTINSINE = 'EASEOUTINSINE',
	EASEOUTQUAD = 'EASEOUTQUAD',
	EASEOUTQUART = 'EASEOUTQUART',
	EASEOUTQUINT = 'EASEOUTQUINT',
	EASEOUTSINE = 'EASEOUTSINE',
	IN_BACK = 'IN_BACK',
	IN_BOUNCE = 'IN_BOUNCE',
	IN_CIRC = 'IN_CIRC',
	IN_CUBIC = 'IN_CUBIC',
	IN_ELASTIC = 'IN_ELASTIC',
	IN_EXPO = 'IN_EXPO',
	IN_OUT_BACK = 'IN_OUT_BACK',
	IN_OUT_BOUNCE = 'IN_OUT_BOUNCE',
	IN_OUT_CIRC = 'IN_OUT_CIRC',
	IN_OUT_CUBIC = 'IN_OUT_CUBIC',
	IN_OUT_ELASTIC = 'IN_OUT_ELASTIC',
	IN_OUT_EXPO = 'IN_OUT_EXPO',
	IN_OUT_QUAD = 'IN_OUT_QUAD',
	IN_OUT_QUART = 'IN_OUT_QUART',
	IN_OUT_QUINT = 'IN_OUT_QUINT',
	IN_OUT_SINE = 'IN_OUT_SINE',
	IN_QUAD = 'IN_QUAD',
	IN_QUART = 'IN_QUART',
	IN_QUINT = 'IN_QUINT',
	IN_SINE = 'IN_SINE',
	OUT_BACK = 'OUT_BACK',
	OUT_BOUNCE = 'OUT_BOUNCE',
	OUT_CIRC = 'OUT_CIRC',
	OUT_CUBIC = 'OUT_CUBIC',
	OUT_ELASTIC = 'OUT_ELASTIC',
	OUT_EXPO = 'OUT_EXPO',
	OUT_IN_BACK = 'OUT_IN_BACK',
	OUT_IN_BOUNCE = 'OUT_IN_BOUNCE',
	OUT_IN_CIRC = 'OUT_IN_CIRC',
	OUT_IN_CUBIC = 'OUT_IN_CUBIC',
	OUT_IN_ELASTIC = 'OUT_IN_ELASTIC',
	OUT_IN_EXPO = 'OUT_IN_EXPO',
	OUT_IN_QUAD = 'OUT_IN_QUAD',
	OUT_IN_QUART = 'OUT_IN_QUART',
	OUT_IN_QUINT = 'OUT_IN_QUINT',
	OUT_IN_SINE = 'OUT_IN_SINE',
	OUT_QUAD = 'OUT_QUAD',
	OUT_QUART = 'OUT_QUART',
	OUT_QUINT = 'OUT_QUINT',
}

declare enum Direction {
	LEFT = 'LEFT',
	RIGHT = 'RIGHT',
}

// RunDownAPI
declare enum LineItemStatusCode {
	/** No status has been determined (yet) */
	UNKNOWN = -1,
	/** No fault with item, can be played */
	OK = 0,
	/** The source (file, live input) is missing and cannot be played, as it would result in BTA */
	SOURCE_MISSING = 1,
	/** The source is present, but should not be played due to a technical malfunction (file is broken, camera robotics failed, REMOTE input is just bars, etc.) */
	SOURCE_BROKEN = 2
}

declare enum SegmentLineItemLifespan {
	Normal = 0,
	OutOnNextSegmentLine = 1,
	OutOnNextSegment = 2,
	Infinite = 3,
}
declare enum PlayoutTimelinePrefixes {
	SEGMENT_LINE_GROUP_PREFIX = 'sl_group_',
	SEGMENT_LINE_GROUP_FIRST_ITEM_PREFIX = 'sl_group_firstobject_',
	SEGMENT_LINE_ITEM_GROUP_PREFIX = 'sli_group_',
	SEGMENT_LINE_ITEM_GROUP_FIRST_ITEM_PREFIX = 'sli_group_firstobject_',
}
declare enum SegmentLineHoldMode {
	NONE = 0,
	FROM = 1,
	TO = 2,
}
`, libName)
		}
		let typings
		if (this.props.functionTyping) {
			// convert functionTyping to typings:
			typings = this.convertFunctionTyping(this.props.functionTyping)
		} else {
			typings = (
				'declare type Arg0 = Context\n' +
				'declare type Arg1 = Story'
			)
		}

		delete monaco.languages.typescript.javascriptDefaults['_extraLibs']['functionTyping.d.ts']
		monaco.languages.typescript.javascriptDefaults.addExtraLib(typings, 'functionTyping.d.ts')
		if (!this._editor) {
			this._editor = monaco.editor.create(document.getElementById('monaco-container')!, {
				value: this.props.runtimeFunction.code,
				language: 'javascript',
				automaticLayout: true,
			})
			this._editorEventListeners.push(this._editor.onDidChangeModelContent((e: monaco.editor.IModelContentChangedEvent) => {
				this.triggerSave(this._editor.getModel().getValue())
			}))
			this._editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, (e: any) => {
				this.saveCode(e)
			}, '')
		}
	}
	componentWillUnmount () {
		if (typeof process === 'object') {
			// this is a workaround for broken platform (electron vs browser) detection in Microsoft Monaco
			// this reverts the platform to proper value, in case anyone actually uses this
			// @ts-ignore
			process.platform = MonacoWrapper._processPlatform
		}
		delete process.platform
		this._editorEventListeners.forEach((listener) => {
			listener.dispose()
		})
	}
	convertFunctionTyping (args: any[]): string {
		// Converts an array of arguments to a typing declaration
		let typings: Array<string> = []
		let typingContentI = 0
		let resolveTypingContent = (o, name?: string) => {
			let str = ''
			if (_.isArray(o)) {
				name = name || ('Arr' + (typingContentI++))

				str += 'declare type ' + name + ' = Array<'

				let o2 = _.first(o)

				let c = resolveTypingContent(o2)
				str += c
				str += '>\n'
				typings.push(str)
				return name
			} else if (_.isObject(o)) {
				name = name || ('Obj' + (typingContentI++))

				str += 'declare interface ' + name + ' {\n'
				_.each(o, (val, key) => {
					let c = resolveTypingContent(val)
					str += '  ' + key + ': ' + c + '\n'
				})
				str += '}\n'
				typings.push(str)
				return name
			} else if (_.isString(o)) {
				return '"' + o + '"'
			} else if (_.isNumber(o)) {
				return o
			} else {
				return typeof o
				// return typeof o
			}
		}
		let argI = 0
		_.each(args, (arg) => {
			let name = 'Arg' + argI
			if (_.isArray(arg)) {
				resolveTypingContent(arg, name)
			} else if (_.isObject(arg)) {
				resolveTypingContent(arg, name)
			} else {
				typings.push('declare type ' + name + ' = ' + (typeof arg))
			}
			argI++
		})

		return typings.reverse().join('\n')
	}

	setRef = (el: HTMLDivElement) => {
		if (el) {
			if (!MonacoWrapper._monacoRef) {
				// let that = this
				this._container = el
				MonacoWrapper._requireBuffer = window['require']
				window['require'] = undefined
				// this is a workaround for broken platform (electron vs browser) detection in Microsoft Monaco
				// @ts-ignore
				if (typeof process === 'object' && typeof process.nextTick === 'function' && typeof process.platform === 'string' && process.platform === 'browser') {
					MonacoWrapper._processPlatform = process.platform
					delete process.platform
				}
				let newScript = document.createElement('script')
				newScript.addEventListener('load', () => {
					MonacoWrapper._monacoRequire = MonacoWrapper._monacoRequire || window['require']
					window['require'] = MonacoWrapper._requireBuffer
					MonacoWrapper._monacoRequire.config({ paths: { 'vs': '/monaco-editor/min/vs' } })
					MonacoWrapper._monacoRequire(['vs/editor/editor.main'], () => {
						MonacoWrapper._monacoRef = monaco
						this.attachEditor()
					})
				})
				newScript.src = '/monaco-editor/min/vs/loader.js'
				el.appendChild(newScript)
			} else {
				this.attachEditor()
			}
		}
	}

	triggerSave (newCode) {
		this.setState({
			unsavedChanges: true
		})
		this._currentCode = newCode

		// Auto-save in a while:
		// if (this._saveTimeout) Meteor.clearTimeout(this._saveTimeout)
		// this._saveTimeout = Meteor.setTimeout(() => {
		// 	this.saveCode()
		// }, 30 * 1000)

		// Auto-test in a while:
		if (this._testTimeout) Meteor.clearTimeout(this._testTimeout)
		this._testTimeout = Meteor.setTimeout(() => {
			this.testCode()
		}, 3 * 1000)
	}

	testCode () {
		if (this._currentCode ) {
			Meteor.call(RuntimeFunctionsAPI.TESTCODE, {code: this._currentCode}, this.props.runtimeFunction.showStyleId, this.props.runtimeFunction.isHelper, (e) => {
				if (e) {
					this.setState({
						message: 'Error when testing code: ' + e.toString()
					})
					// console.log('e')
					// console.log(e)
				} else {
					this.setState({
						message: 'Test ok'
					})
				}
			})
		}
	}
	saveCode (e) {
		this.setState({
			saving: true
		})
		if (this._currentCode) {
			Meteor.call(ClientAPI.methods.execMethod, eventContextForLog(e), RuntimeFunctionsAPI.UPDATECODE, this.props.runtimeFunction._id, this._currentCode, (e) => {
				if (e) {
					this.setState({
						message: e.toString()
					})
					// console.log(e)
				} else {
					this.setState({
						unsavedChanges: false,
						saving: false,
						message: 'Saved OK'
					})
				}
			})
		} else {
			this.setState({
				saving: false,
				message: 'Did not save, because template is empty'
			})
		}
	}

	render () {
		return <div ref={this.setRef}>
					<div className='runtime-function-edit__status'>
						{this.state.unsavedChanges ? (
							<div>
								<b>Unsaved changes </b>
								<button className='btn btn-primary' onClick={(e) => this.saveCode(e)}>
									<FontAwesomeIcon icon={faSave} />
								</button>
							</div>
						) : null}
						{this.state.saving ? ' Saving...' : ''}
					</div>
					<div id='monaco-container' className='runtime-function-edit__editor'></div>
					<div className='runtime-function-edit__message'>
						<pre>{this.state.message}</pre>
					</div>
			   </div>
	}
}

interface IProps {
	match: {
		params: {
			ltId: string
		}
	}
}
interface IState {
	code: string
}
interface ITrackedProps {
	lineTemplate?: RuntimeFunction
	runtimeFunctionDebugData?: RuntimeFunctionDebugDataObj
}
export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {

	let rtfddId = Session.get('rtfdd_' + props.match.params.ltId)
	return {
		lineTemplate: RuntimeFunctions.findOne(props.match.params.ltId),
		runtimeFunctionDebugData: RuntimeFunctionDebugData.findOne(rtfddId)
	}
})(class LineTemplates extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	componentWillMount () {
		this.autorun(() => {
			if (this.props.lineTemplate) {
				let rtfddId = Session.get('rtfdd_' + this.props.lineTemplate._id)

				this.subscribe('runtimeFunctionDebugDataData', rtfddId)
			}
		})
	}
	updateTemplateId (edit: EditAttributeBase, newValue: any) {
		Meteor.call(ClientAPI.methods.execMethod, '', RuntimeFunctionsAPI.UPDATETEMPLATEID, edit.props.obj._id, newValue, (err, res) => {
			if (err) {
				console.log(err)
			} else {
				// Nothing
			}
		})
	}
	updateIsHelper (edit: EditAttributeBase, newValue: any) {
		Meteor.call(ClientAPI.methods.execMethod, '', RuntimeFunctionsAPI.UPDATEISHELPER, edit.props.obj._id, newValue, (err, res) => {
			if (err) {
				console.log(err)
			} else {
				// Nothing
			}
		})
	}
	getFunctionTyping (): any[] | null {
		if (this.props.runtimeFunctionDebugData) {
			return this.props.runtimeFunctionDebugData.data || null
		}
		return null
	}
	renderEditForm () {
		const { t } = this.props

		if (this.props.lineTemplate) {
			// @todo - disable editing of fields on getId template
			return (
				<div className='studio-edit mod mhl mvs'>
					<div>
						<label className='field'>
							{t('Blueprint ID')}
							<div className='mdi'>
								<EditAttribute
									modifiedClassName='bghl'
									attribute='templateId'
									obj={this.props.lineTemplate}
									type='text'
									collection={RuntimeFunctions}
									className='mdinput'
									updateFunction={this.updateTemplateId}
								/>
								<span className='mdfx'></span>
							</div>
						</label>
						<label className='field'>
							<EditAttribute
								modifiedClassName='bghl'
								attribute='isHelper'
								obj={this.props.lineTemplate}
								type='checkbox'
								collection={RuntimeFunctions}
								className='mdinput'
								updateFunction={this.updateIsHelper}
								/>
							{t('Is Helper')}
						</label>
					</div>
					<div>
						<SelectRFDD lineTemplate={this.props.lineTemplate}/>
					</div>
					<MonacoWrapper runtimeFunction={this.props.lineTemplate} functionTyping={this.getFunctionTyping()} />
				</div>
			)
		}
		return null
	}
	render () {
		const { t } = this.props

		if (this.props.lineTemplate) {
			return this.renderEditForm()
		} else {
			return <Spinner />
		}
	}
})

interface SelectRFDDProps {
	lineTemplate: RuntimeFunction
}
interface ISelectRFDDTrackedProps {
	runtimeFunctionDebugData: Array<RuntimeFunctionDebugDataObj>
	selectedRtfdd: string | undefined
}
let SelectRFDD = translateWithTracker<SelectRFDDProps, IState, ISelectRFDDTrackedProps>((props: SelectRFDDProps) => {
	return {
		runtimeFunctionDebugData: RuntimeFunctionDebugData.find({
			showStyleId: props.lineTemplate.showStyleId,
			templateId: props.lineTemplate.templateId
		}).fetch(),
		selectedRtfdd: Session.get('rtfdd_' + props.lineTemplate._id)
	}
})(class SelectRFDD extends MeteorReactComponent<Translated<SelectRFDDProps & ISelectRFDDTrackedProps>, IState> {
	componentWillMount () {
		// Subscribe to data:
		this.subscribe('runtimeFunctionDebugData', {
			showStyleId: this.props.lineTemplate.showStyleId,
			templateId: this.props.lineTemplate.templateId
		})
	}
	select (rtfdd) {
		Session.set('rtfdd_' + this.props.lineTemplate._id, rtfdd._id)
	}
	isSelected (rtfdd): boolean {
		return this.props.selectedRtfdd === rtfdd._id
	}
	remove (rtfdd) {
		RuntimeFunctionDebugData.remove(rtfdd._id)
	}
	render () {
		const { t } = this.props

		return (
			this.props.runtimeFunctionDebugData.length ? (
				<table className='settings-line-templates-snapshots'>
					<thead>
						<tr>
							<th>Timestamp</th>
							<th>Snapshot name</th>
							<th>Keep</th>
							<th>Select</th>
							<th className='actions'>Remove</th>
						</tr>
					</thead>
					<tbody>
						{_.map(this.props.runtimeFunctionDebugData, (rtfdd) => {
							return (
								<tr key={rtfdd._id}>
									<td>
										<MomentFromNow>{rtfdd.created}</MomentFromNow>
									</td>
									<td>
										{rtfdd.reason}
									</td>
									<td>
										<EditAttribute
											attribute='dontRemove'
											obj={rtfdd}
											type='checkbox'
											collection={RuntimeFunctionDebugData}
										/>
									</td>
									<td>
										<button className={ClassNames('btn-tight', this.isSelected(rtfdd) ? 'btn-default' : 'btn-primary')}
											onClick={() => this.select(rtfdd)}>{t('Select this')}
										</button>
									</td>
									<td className='actions'>
										<button className='action-btn' onClick={(e) => this.remove(rtfdd)}>
											<FontAwesomeIcon icon={faTrash} />
										</button>
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			) : null
		)
	}
})
