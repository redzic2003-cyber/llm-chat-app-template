<script lang="ts">
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import Bell from '@lucide/svelte/icons/bell';
	import FileDown from '@lucide/svelte/icons/file-down';
	import image from '#lib/assets/images/application-mobile.jpg?enhanced';

	const features = [
		{ icon: Smartphone, text: 'Le téléphone remplace le badge' },
		{ icon: Bell, text: 'Notifications d’arrivée et d’absence' },
		{ icon: FileDown, text: 'Export des présences en quelques clics' }
	];
</script>

<section id="application" class="scroll-mt-16 py-20 sm:py-24">
	<div class="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
		<div class="lg:order-2">
			<enhanced:img
				src={image}
				alt="Application mobile chronoID affichant le profil d’une employée, devant une borne murale"
				class="w-full rounded-2xl object-cover"
				sizes="(min-width: 1024px) 40vw, 100vw"
				loading="lazy"
			/>
		</div>

		<div>
			<p class="eyebrow">Application mobile</p>
			<h2 class="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
				Suivez vos équipes en temps réel.
			</h2>
			<p class="mt-4 text-lg text-muted">
				Présences, accès et badge : vos collaborateurs ont tout dans leur poche, et vous gardez une
				vue d’ensemble.
			</p>
			<ul class="mt-8 space-y-4">
				{#each features as f (f.text)}
					<li class="flex items-center gap-3">
						<f.icon class="size-5 text-brand" aria-hidden="true" />
						<span>{f.text}</span>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</section>
