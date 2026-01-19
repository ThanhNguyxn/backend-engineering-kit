// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://thanhnguyxn.github.io',
	base: '/backend-engineering-kit',
	integrations: [
		starlight({
			title: 'Backend Engineering Kit',
			description: 'Production-grade patterns, templates, and tools for backend development',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/ThanhNguyxn/backend-engineering-kit' },
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'guides/introduction' },
						{ label: 'Installation', slug: 'guides/installation' },
						{ label: 'Quick Start', slug: 'guides/quickstart' },
						{ label: 'How It Works', slug: 'guides/how-it-works' },
					],
				},
				{
					label: 'Patterns',
					items: [
						{ label: 'Pattern Gallery', slug: 'patterns/gallery' },
					],
				},
				{
					label: 'Templates',
					items: [
						{ label: 'Template Gallery', slug: 'templates/gallery' },
						{ label: 'Node.js Minimal', slug: 'templates/node-minimal' },
						{ label: 'Node.js Standard', slug: 'templates/node-standard' },
						{ label: 'Python FastAPI', slug: 'templates/python-fastapi' },
						{ label: 'Go Minimal', slug: 'templates/go-minimal' },
						{ label: 'Add a Template', slug: 'guides/add-template' },
					],
				},
				{
					label: 'CLI Reference',
					autogenerate: { directory: 'cli' },
				},
			],
			customCss: ['./src/styles/custom.css'],
		}),
	],
});
