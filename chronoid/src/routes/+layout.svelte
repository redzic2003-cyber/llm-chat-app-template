<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import BrandFonts from '#lib/components/BrandFonts.svelte';
	import Header from '#lib/components/Header.svelte';
	import Footer from '#lib/components/Footer.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { baseLocale, locales } from '#lib/paraglide/runtime.js';
	import { SITE_URL, hrefFor } from '#lib/site.js';

	let { children } = $props();

	const urlFor = (locale: (typeof locales)[number]) =>
		new URL(hrefFor(page.url.pathname, locale), SITE_URL).href;
</script>

<BrandFonts />

<svelte:head>
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<meta name="theme-color" content="#ffffff" />
	<link rel="canonical" href={new URL(page.url.pathname, SITE_URL).href} />
	{#each locales as locale (locale)}
		<link rel="alternate" hreflang={locale} href={urlFor(locale)} />
	{/each}
	<link rel="alternate" hreflang="x-default" href={urlFor(baseLocale)} />
</svelte:head>

<a
	href="#contenu"
	class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow"
>
	{m.skip_link()}
</a>

<Header />
<main id="contenu">
	{@render children()}
</main>
<Footer />
