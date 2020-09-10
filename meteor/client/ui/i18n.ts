import i18n, { TFunction } from 'i18next'
import Backend from 'i18next-xhr-backend'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { WithManagedTracker } from '../lib/reactiveData/reactiveDataHelper'
import { PubSub } from '../../lib/api/pubsub'
import { TranslationsBundles } from '../../lib/collections/TranslationsBundles'

const i18nOptions = {
	fallbackLng: {
		nn: ['nb', 'en'],
		default: ['en'],
	},

	// have a common namespace used around the full app
	ns: ['translations'],
	defaultNS: 'translations',

	debug: false,
	joinArrays: '\n',

	whitelist: ['en', 'nb', 'nn', 'sv'],

	keySeparator: '→',
	nsSeparator: '⇒',
	pluralSeparator: '⥤',
	contextSeparator: '⥤',

	interpolation: {
		escapeValue: false, // not needed for react!!
	},

	react: {
		wait: true,
		useSuspense: false,
	},
}

class I18nContainer extends WithManagedTracker {
	i18nInstance: typeof i18n

	constructor() {
		super()

		this.i18nInstance = i18n
			.use(Backend)
			.use(LanguageDetector)
			.use(initReactI18next)

		this.i18nInstance.init(i18nOptions, (err: Error, t: TFunction) => {
			if (err) {
				console.error('Error initializing i18Next:', err)
			} else {
				this.i18nTranslator = t
				console.debug(`i18nTranslator init complete, using language ${this.i18nInstance.language}`)
			}
		})

		this.subscribe(PubSub.translationsBundles, {})
		this.autorun(() => {
			console.debug('ManagedTracker autorun...')
			const bundles = TranslationsBundles.find().fetch()
			console.debug(`Got ${bundles.length} bundles from database`)
			for (const bundle of bundles) {
				if (Object.keys(bundle.data).length > 0) {
					this.i18nInstance.addResourceBundle(
						bundle.language,
						bundle.namespace || i18nOptions.defaultNS,
						bundle.data,
						true,
						true
					)
					console.debug('i18instance updated', { bundle: { lang: bundle.language, ns: bundle.namespace } })
				} else {
					console.debug(`Skipped bundle, no translations`, { bundle })
				}
			}
		})
	}
	// return key until real translator comes online
	i18nTranslator(key, ...args) {
		console.debug('i18nTranslator placeholder called', { key, args })

		if (!args[0]) {
			return key
		}

		if (typeof args[0] === 'string') {
			return key || args[0]
		}

		if (args[0].defaultValue) {
			return args[0].defaultValue
		}

		if (typeof key !== 'string') {
			return key
		}

		const options = args[0]
		if (options?.replace) {
			Object.assign(options, { ...options.replace })
		}

		const interpolated = String(key)
		for (const placeholder of key.match(/[^{\}]+(?=})/g) || []) {
			const value = options[placeholder] || placeholder
			interpolated.replace(`{{${placeholder}}}`, value)
		}

		return interpolated
	}
}

const container = new I18nContainer()
const i18nTranslator: TFunction = (key, options) => {
	return container.i18nTranslator(key, options)
}

export { i18nTranslator }

/*
 Notes:
 * How to use i18n in React:
	export const MyReactClass = withTranslation()(class MyReactClass extends React.Component<IProps & WithTranslation, IState> {
		render () {
			const {t} = this.props
			t('My name is {{name}}', {name: 'foobar'})
		}
	})

 * How to use in script:
	import { i18nTranslator } from '../i18n'
	const t = i18nTranslator
	return t('My name is {{name}}', {name: 'foobar'})
 */
