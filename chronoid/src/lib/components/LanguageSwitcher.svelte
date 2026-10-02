<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale, locales } from '#lib/paraglide/runtime.js';
	import { hrefFor, localeNames } from '#lib/site.js';

	let { class: className = '' }: { class?: string } = $props();

	const current = getLocale();
</script>

<nav aria-label={m.lang_switch_label()} class={className}>
	<ul class="flex items-center gap-0.5 rounded-lg bg-ink/5 p-0.5 text-xs font-semibold">
		{#each locales as locale (locale)}
			<li>
				<!-- Rechargement complet : chaque langue est une page prérendue distincte -->
				<a
					href={hrefFor(page.url.pathname, locale)}
					hreflang={locale}
					lang={locale}
					title={localeNames[locale]}
					aria-current={locale === current ? 'true' : undefined}
					data-sveltekit-reload
					class="block rounded-md px-2 py-1 uppercase transition-colors {locale === current
						? 'bg-white text-ink shadow-sm'
						: 'text-muted hover:text-ink'}"
				>
					{locale}
				</a>
			</li>
		{/each}
	</ul>
</nav>
