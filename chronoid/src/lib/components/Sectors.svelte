<script lang="ts">
	import { sectors } from '#lib/content.js';
</script>

<section id="secteurs" class="scroll-mt-16 bg-surface py-20 sm:py-24">
	<div class="container-page">
		<div class="max-w-2xl">
			<p class="eyebrow">Secteurs</p>
			<h2 class="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
				Adaptées à tous vos environnements.
			</h2>
			<p class="mt-4 text-lg text-muted">
				Bureaux, ateliers, hôpitaux, campus ou salons : la même borne, configurée pour votre
				quotidien.
			</p>
		</div>

		<ul class="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
			{#each sectors as sector (sector.title)}
				<li class="group overflow-hidden rounded-xl border border-line bg-white">
					<div class="aspect-[4/5] overflow-hidden">
						<enhanced:img
							src={sector.image}
							alt={sector.alt}
							class="size-full object-cover transition-transform duration-500 group-hover:scale-105"
							sizes="(min-width: 1024px) 20vw, (min-width: 640px) 50vw, 100vw"
							loading="lazy"
						/>
					</div>
					<div class="p-5">
						<h3 class="font-semibold">{sector.title}</h3>
						<p class="mt-2 text-sm leading-relaxed text-muted">{sector.text}</p>
					</div>
				</li>
			{/each}
		</ul>
	</div>
</section>
