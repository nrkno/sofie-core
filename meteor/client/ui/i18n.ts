import * as i18n from 'i18next'
import * as Backend from 'i18next-xhr-backend'
import * as LanguageDetector from 'i18next-browser-languagedetector'
import { reactI18nextModule } from 'react-i18next'
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
	},
}

class I18nContainer extends WithManagedTracker {
	i18nInstance: i18n.i18n
	i18nTranslator: i18n.TranslationFunction<any, object, string>

	constructor() {
		super()

		this.i18nInstance = i18n
			.use(Backend)
			.use(LanguageDetector)
			.use(reactI18nextModule)
			.init(i18nOptions, (err, t) => {
				if (err) {
					console.error('Error initializing i18Next', err)
				} else {
					this.i18nTranslator = t
				}
			})

		this.subscribe(PubSub.translationsBundles, null)
		this.autorun(() => {
			console.debug('ManagedTracker autorun...')
			const bundles = TranslationsBundles.find().fetch()
			console.debug(`Got ${bundles.length} bundles from database`)
			for (const bundle of bundles) {
				this.i18nInstance.addResourceBundle(
					bundle.language,
					bundle.namespace || i18nOptions.defaultNS,
					bundle.data,
					true,
					true
				)
				console.debug('i18instance updated', { bundle: { lang: bundle.language, ns: bundle.namespace } })
			}
		})
	}
}

const container = new I18nContainer()
const { i18nInstance, i18nTranslator } = container

export { i18nInstance, i18nTranslator }

/*
 Notes:
 * How to use i18n in React:
	export const MyReactClass = translate()(class MyReactClass extends React.Component<IProps & InjectedTranslateProps, IState> {
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
