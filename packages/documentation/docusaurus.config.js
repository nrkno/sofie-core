const lightCodeTheme = require('prism-react-renderer/themes/github')
const darkCodeTheme = require('prism-react-renderer/themes/dracula')

/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
	title: 'Sofie TV Automation Documentation',
	tagline: '',
	url: 'https://nrkno.github.io',
	baseUrl: '/sofie-core/',
	onBrokenLinks: 'warn',
	onBrokenMarkdownLinks: 'warn',
	favicon: 'img/favicon.ico',
	organizationName: 'nrkno',
	projectName: 'sofie-core',
	themeConfig: {
		hideableSidebar: true,
		autoCollapseSidebarCategories: true,
		navbar: {
			title: 'Sofie TV Automation',
			logo: {
				alt: 'Sofie Logo',
				src: 'img/sofie-logo.svg',
			},
			items: [
				{ to: '/docs/user-guide/intro', label: 'User Guide', position: 'left' },
				{ to: '/docs/for-developers/intro', label: 'For Developers', position: 'left' },
				{ to: '/docs/releases', label: 'Releases', position: 'left' },

				{
					type: 'docsVersionDropdown',

					position: 'right',
					// Add additional dropdown items at the beginning/end of the dropdown.
					dropdownItemsBefore: [],
					// dropdownItemsAfter: [{ to: '/versions', label: 'All versions' }],
					// Do not add the link active class when browsing docs.
					dropdownActiveClassDisabled: true,
					docsPluginId: 'default',
				},
				{
					href: 'https://github.com/nrkno/sofie-core',
					label: 'GitHub',
					position: 'right',
				},
			],
		},
		footer: {
			style: 'dark',
			links: [
				{
					//title: 'Documentation',
					items: [
						{ to: '/docs/user-guide/intro', label: 'User Guide', position: 'left' },
						{ to: '/docs/for-developers/intro', label: 'For Developers', position: 'left' },
						{ to: '/docs/releases', label: 'Releases', position: 'left' },
					],
				},
				{
					//title: 'Community',
					items: [
						{
							label: 'Sofie Slack Community',
							href: 'https://join.slack.com/t/sofietv/shared_invite/enQtNTk2Mzc3MTQ1NzAzLTJkZjMyMDg3OGM0YWU3MmU4YzBhZDAyZWI1YmJmNmRiYWQ1OTZjYTkzOTkzMTA2YTE1YjgxMmVkM2U1OGZlNWI',
						},
					],
				},
				{
					//title: 'About Sofie',
					items: [{ to: '/docs/about-sofie', label: 'About Sofie', position: 'right' }],
				},
				/* 				{
					title: 'More',
					items: [
						// {
						//   label: 'Blog',
						//   to: '/blog',
						// },
						{
							label: 'GitHub',
							href: 'https://github.com/nrkno?q=tv-automation-&type=source&language=&sort=',
						},
					],
				},
 */
			],
			copyright: `Copyright ©${new Date().getFullYear()} Norsk rikskringkasting AS and Contributors`,
		},
		prism: {
			theme: lightCodeTheme,
			darkTheme: darkCodeTheme,
		},
	},
	presets: [
		[
			'@docusaurus/preset-classic',
			{
				docs: {
					sidebarPath: require.resolve('./sidebars.js'),
					editUrl: 'https://github.com/nrkno/sofie-core/edit/master/packages/documentation/',
					// default to the 'next' docs
					lastVersion: 'current',
					versions: {
						// Override the rendering of the 'next' docs to be 'latest'
						current: {
							label: 'Latest',
							banner: 'none',
						},
					},
				},
				// blog: {
				//   showReadingTime: true,
				//   // Please change this to your repo.
				//   editUrl:
				//     'https://github.com/facebook/docusaurus/edit/master/website/blog/',
				// },
				theme: {
					customCss: require.resolve('./src/css/custom.css'),
				},
			},
		],
	],
	plugins: [
		// [
		// 	'@docusaurus/plugin-content-docs',
		// 	{
		// 		id: 'releases',
		// 		path: 'releases',
		// 		routeBasePath: 'releases',
		// 		sidebarPath: require.resolve('./sidebarsReleases.js'),
		// 		// ... other options
		// 	},
		// ],
		// [
		//   '@docusaurus/plugin-content-docs',
		//   {
		//     id: 'legacy',
		//     path: 'legacy',
		//     routeBasePath: 'legacy',
		//     sidebarPath: require.resolve('./sidebars.js'),
		//     // ... other options
		//   },
		// ],
	],
}
