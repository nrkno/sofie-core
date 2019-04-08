import * as _ from 'underscore'

const speechSynthesis = window.speechSynthesis

const VOICE_PREFERENCE = [ // ordered in preferred order (best first)
	'Google uk English Female',
	'Google uk English Male',
	'en-gb',
	'en-us',
	'-default',
]
const VOICE_PITCH = 0.9
const VOICE_RATE = 1 // speed

class SpeechSynthesisClass {
	private _isInitialized: boolean = false
	private _voice: SpeechSynthesisVoice | undefined

	private _queue: Array<string> = []
	init () {
		if (!this._isInitialized) {
			this._isInitialized = true

			if (speechSynthesis) {
				this._voice = this.selectVoice()
			} else {
				console.error('Speech synthesis not available')
			}
		}
	}
	speak (textToSpeak: string) {
		return this._speak(textToSpeak)
	}
	_speak (textToSpeak: string, fromQueue?: boolean) {
		if (!this._isInitialized) {
			console.error('Speech synthesis not initialized')
			return
		}
		if (!this._voice) {
			console.error('SpeechSynthesis: No voice found')
			return
		}
		if (!textToSpeak) {
			// do nothing
			return
		}
		if (speechSynthesis.speaking) {
			// Put on queue
			if (fromQueue) {
				this._queue.unshift(textToSpeak)
			} else {
				this._queue.push(textToSpeak)
			}
			return
		}

		let utterThis = new SpeechSynthesisUtterance(textToSpeak)
		utterThis.onend = () => {
			this._checkQueue()
		}
		utterThis.onerror = (event) => {
			this._checkQueue()
			console.error('SpeechSynthesisUtterance.onerror', event)
		}
		utterThis.voice = this._voice
		utterThis.pitch = VOICE_PITCH
		utterThis.rate = VOICE_RATE
		speechSynthesis.speak(utterThis)
	}
	private _checkQueue () {
		let textToSpeak = this._queue.shift()
		if (textToSpeak) {
			this.speak(textToSpeak)
		}
	}
	private selectVoice (): SpeechSynthesisVoice | undefined {

		const voices = _.map(speechSynthesis.getVoices(), (voice) => {

			const voiceName = voice.name + ` (${voice.lang})` + (voice.default ? ' -default' : '')

			let weight = 999
			_.each(VOICE_PREFERENCE, (n, i) => {
				if (voiceName.match(new RegExp(n, 'i'))) weight = i
			})
			return { weight, voice }
		}).sort((a, b) => {
			return a.weight - b.weight
		})
		return (voices[0] || {}).voice
	  }
}

// Singleton:
export const SpeechSynthesiser = new SpeechSynthesisClass()
