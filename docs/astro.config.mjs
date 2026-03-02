// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
	adapter: node({ mode: 'standalone' }),
	integrations: [
		starlight({
			title: 'Covenant RPC',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/firesquid6/covenant-rpc' }],
			sidebar: [
				{
					label: 'Handbook',
          autogenerate: { directory: 'handbook' },
				},
				{
					label: 'Recipes',
					autogenerate: { directory: 'recipes' },
				},
			],
		}),
	],
});
