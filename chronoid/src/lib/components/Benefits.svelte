<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import Leaf from '@lucide/svelte/icons/leaf';

	const benefits = [
		{ icon: Clock, label: 'Gain de temps', text: 'Pointage en une seconde, sans saisie.' },
		{
			icon: ShieldCheck,
			label: 'Meilleure sécurité',
			text: 'Seules les bonnes personnes entrent.'
		},
		{ icon: BadgeCheck, label: 'Suivi précis', text: 'Des présences fiables, prêtes à exporter.' },
		{ icon: Leaf, label: 'Solution durable', text: 'Matériel robuste, conçu pour durer.' }
	];
</script>

<section aria-label="Avantages" class="border-y border-line bg-white">
	<ul class="container-page grid grid-cols-2 lg:grid-cols-4">
		{#each benefits as b, i (b.label)}
			<li
				class="flex flex-col items-center px-4 py-8 text-center
				{i % 2 === 1 ? 'border-l border-line' : ''}
				{i === 2 ? 'lg:border-l' : ''}
				{i >= 2 ? 'border-t border-line lg:border-t-0' : ''}"
			>
				<b.icon class="size-7 text-ink" strokeWidth={1.6} aria-hidden="true" />
				<h2 class="mt-3 text-sm font-semibold">{b.label}</h2>
				<p class="mt-1 text-sm text-muted">{b.text}</p>
			</li>
		{/each}
	</ul>
</section>
