<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import { products } from '#lib/content.js';
	import { m } from '#lib/paraglide/messages.js';

	const items = products();
</script>

<section id="produits" class="scroll-mt-24 bg-surface py-20 sm:py-24">
	<div class="container-page">
		<div class="max-w-2xl">
			<p class="eyebrow">{m.products_eyebrow()}</p>
			<h2 class="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
				{m.products_title()}
			</h2>
		</div>

		<ul class="mt-12 grid gap-6 md:grid-cols-2">
			{#each items as product (product.name)}
				<li
					class="grid overflow-hidden rounded-2xl border border-line bg-white sm:grid-cols-[2fr_3fr]"
				>
					<enhanced:img
						src={product.image}
						alt={product.alt}
						class="aspect-[4/3] size-full object-cover sm:aspect-auto"
						sizes="(min-width: 768px) 20vw, 100vw"
						loading="lazy"
					/>
					<div class="flex flex-col p-6 sm:p-8">
						<h3 class="text-xl font-semibold">{product.name}</h3>
						<p class="mt-2 text-muted">{product.tagline}</p>
						<ul class="mt-6 space-y-3 text-sm">
							{#each product.features as feature (feature)}
								<li class="flex items-center gap-2">
									<Check class="size-4 shrink-0 text-brand" aria-hidden="true" />
									{feature}
								</li>
							{/each}
						</ul>
						<a href="#demo" class="mt-8 btn-outline self-start">{m.products_cta()}</a>
					</div>
				</li>
			{/each}
		</ul>
	</div>
</section>
