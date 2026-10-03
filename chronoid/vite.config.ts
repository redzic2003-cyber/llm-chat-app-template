import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { enhancedImages } from '@sveltejs/enhanced-img';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { BASE_PATH } from './src/lib/base-path';

// Préfixe d'URL Paraglide : /frontend (fr), /frontend/de, /frontend/it, /frontend/en
const site = `:protocol://:domain(.*)::port?${BASE_PATH}`;

export default defineConfig({
	plugins: [
		enhancedImages(),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			paths: { base: BASE_PATH }
		}),

		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true,
			// Langue lue dans l'URL : / (fr), /de, /it, /en. Compatible avec le prérendu.
			strategy: ['url', 'baseLocale'],
			urlPatterns: [
				{
					pattern: `${site}/:path(.*)?`,
					localized: [
						['de', `${site}/de/:path(.*)?`],
						['it', `${site}/it/:path(.*)?`],
						['en', `${site}/en/:path(.*)?`],
						['fr', `${site}/:path(.*)?`]
					]
				}
			]
		})
	]
});
