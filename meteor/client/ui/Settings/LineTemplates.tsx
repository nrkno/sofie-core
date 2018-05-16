import * as ClassNames from 'classnames'
import * as React from 'react'
import { InjectedTranslateProps, translate } from 'react-i18next'
import * as _ from 'underscore'
import { RundownAPI } from '../../../lib/api/rundown'
import { RuntimeFunction, RuntimeFunctions } from '../../../lib/collections/RuntimeFunctions'
import { EditAttribute } from '../../lib/EditAttribute'
import { ModalDialog } from '../../lib/ModalDialog'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { literal, partial } from '../../../lib/lib'
import { Random } from 'meteor/random'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
// import * as monaco from 'monaco-editor'
// import MonacoEditor from 'react-monaco-editor'

interface IPropsHeader {
	lineTemplate: RuntimeFunction
}

interface IStateHeader {
	code: string
}

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
		this._editor = monaco.editor.create(document.getElementById('monaco-container'), {
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

class LineTemplates extends React.Component<IPropsHeader & InjectedTranslateProps, IStateHeader> {
	renderEditForm () {
		const { t } = this.props

		return (
			<MonacoWrapper runtimeFunction={this.props.lineTemplate} />
		)
	}

	render () {
		const { t } = this.props

		if (this.props.lineTemplate) {
			return this.renderEditForm()
		} else {
			return <Spinner />
		}
	}
}

export default translate()(withTracker((props, state) => {
	return {
		lineTemplate: RuntimeFunctions.findOne(props.match.params.ltId)
	}
})(LineTemplates))
