<script lang="ts">
	import './layout.css';
	import Header from '#lib/components/Header.svelte';
	import Footer from '#lib/components/Footer.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<meta name="theme-color" content="#ffffff" />
</svelte:head>

<a
	href="#contenu"
	class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow"
>
	Aller au contenu
</a>

<Header />
<main id="contenu">
	{@render children()}
</main>
<Footer />
