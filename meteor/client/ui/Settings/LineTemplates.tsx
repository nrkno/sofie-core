import * as ClassNames from 'classnames'
import * as React from 'react'
import { translate } from 'react-i18next'
import * as _ from 'underscore'
import { RundownAPI } from '../../../lib/api/rundown'
import { RuntimeFunction, RuntimeFunctions } from '../../../lib/collections/RuntimeFunctions'
import { EditAttribute } from '../../lib/EditAttribute'
import { ModalDialog } from '../../lib/ModalDialog'
import { withTracker, Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { literal, partial } from '../../../lib/lib'
import { Random } from 'meteor/random'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as monaco from 'monaco-editor'
// import MonacoEditor from 'react-monaco-editor'

interface IMonacoPropsHeader {
	runtimeFunction: RuntimeFunction
}

class MonacoWrapper extends React.Component<IMonacoPropsHeader> {
	static _monacoRequire: any
	static _requireBuffer: any
	static _monacoRef: any

	_container: HTMLDivElement
	_editor: monaco.editor.IStandaloneCodeEditor
	_codeId: string

	constructor (props) {
		super(props)
	}

	attachEditor = () => {
		this._editor = monaco.editor.create(document.getElementById('monaco-container')!, {
			value: this.props.runtimeFunction.code,
			language: 'javascript'
		})
		this._editor.onDidChangeModelContent((e: monaco.editor.IModelContentChangedEvent) => {
			RuntimeFunctions.update(this.props.runtimeFunction._id, {
				$set: {
					code: this._editor.getModel().getValue()
				}
			})
		})
	}

	componentDidUpdate () {
		if (this.props.runtimeFunction._id !== this._codeId) {
			this._codeId = this.props.runtimeFunction._id
			this._editor.setModel(monaco.editor.createModel(
				this.props.runtimeFunction.code,
				'javascript'
			))
		}
	}

	setRef = (el: HTMLDivElement) => {
		if (el) {
			if (!MonacoWrapper._monacoRef) {
				let that = this
				this._container = el
				MonacoWrapper._requireBuffer = window['require']
				window['require'] = undefined
				let newScript = document.createElement('script')
				newScript.addEventListener('load', () => {
					MonacoWrapper._monacoRequire = MonacoWrapper._monacoRequire || window['require']
					window['require'] = MonacoWrapper._requireBuffer
					MonacoWrapper._monacoRequire.config({ paths: { 'vs': '/monaco-editor/min/vs' } })
					MonacoWrapper._monacoRequire(['vs/editor/editor.main'], function () {
						MonacoWrapper._monacoRef = monaco
						that.attachEditor()
					})
				})
				newScript.src = '/monaco-editor/min/vs/loader.js'
				el.appendChild(newScript)
			} else {
				this.attachEditor()
			}
		}
	}

	render () {
		return <div ref={this.setRef}>
					<div id='monaco-container' className='runtime-function-edit__editor'></div>
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
}
export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	return {
		lineTemplate: RuntimeFunctions.findOne(props.match.params.ltId)
	}
})(class LineTemplates extends React.Component<Translated<IProps & ITrackedProps>, IState> {
	renderEditForm () {
		const { t } = this.props

		if (this.props.lineTemplate) {
			return (
				<div className='studio-edit mod mhl mvs'>
					<div>
						<label className='field'>
							{t('Template ID')}
							<div className='mdi'>
								<EditAttribute
									modifiedClassName='bghl'
									attribute='_id'
									obj={this.props.lineTemplate}
									type='text'
									collection={RuntimeFunctions}
									className='mdinput'></EditAttribute>
								<span className='mdfx'></span>
							</div>
						</label>
					</div>
					<MonacoWrapper runtimeFunction={this.props.lineTemplate} />
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
