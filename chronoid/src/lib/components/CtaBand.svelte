<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
</script>

<section id="demo" class="scroll-mt-16 bg-ink text-white">
	<div
		class="container-page flex flex-col gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="max-w-2xl">
			<h2 class="text-3xl font-bold tracking-tight sm:text-4xl">
				Prêt à simplifier la gestion des temps ?
			</h2>
			<p class="mt-4 text-lg text-white/70">
				Un expert vous présente la borne adaptée à vos locaux, en 30 minutes.
			</p>
		</div>
		<div class="flex flex-col gap-3 sm:flex-row">
			<a href="mailto:contact@chronoid.ch?subject=Demande%20de%20d%C3%A9mo" class="btn-brand">
				Demander une démo <ArrowRight class="size-4" aria-hidden="true" />
			</a>
			<a
				href="mailto:contact@chronoid.ch"
				class="btn border border-white/25 text-white hover:bg-white/10"
			>
				Parler à un expert
			</a>
		</div>
	</div>
</section>
