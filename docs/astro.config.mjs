// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
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
					label: 'Recpies',
					autogenerate: { directory: 'recipes' },
				},
			],
		}),
	],
});
