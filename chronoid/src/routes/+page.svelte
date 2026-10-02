<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Hero from '#lib/components/Hero.svelte';
	import Benefits from '#lib/components/Benefits.svelte';
	import Sectors from '#lib/components/Sectors.svelte';
	import ConnectedOffline from '#lib/components/ConnectedOffline.svelte';
	import Products from '#lib/components/Products.svelte';
	import MobileApp from '#lib/components/MobileApp.svelte';
	import CtaBand from '#lib/components/CtaBand.svelte';
</script>

<svelte:head>
	<title>{m.meta_title()}</title>
	<meta name="description" content={m.meta_description()} />
</svelte:head>

<Hero />
<Benefits />
<Sectors />
<ConnectedOffline />
<Products />
<MobileApp />
<CtaBand />
