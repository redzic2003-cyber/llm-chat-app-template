<script lang="ts">
	import Hero from '#lib/components/Hero.svelte';
	import Benefits from '#lib/components/Benefits.svelte';
	import Sectors from '#lib/components/Sectors.svelte';
	import ConnectedOffline from '#lib/components/ConnectedOffline.svelte';
	import Products from '#lib/components/Products.svelte';
	import MobileApp from '#lib/components/MobileApp.svelte';
	import CtaBand from '#lib/components/CtaBand.svelte';
</script>

<svelte:head>
	<title>chronoID · Bornes de badges et gestion des temps</title>
	<meta
		name="description"
		content="Bornes de badges connectées ou autonomes pour gérer la présence, la planification et les accès de vos équipes."
	/>
</svelte:head>

<Hero />
<Benefits />
<Sectors />
<ConnectedOffline />
<Products />
<MobileApp />
<CtaBand />
