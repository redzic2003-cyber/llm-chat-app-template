<script lang="ts">
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import Bell from '@lucide/svelte/icons/bell';
	import FileDown from '@lucide/svelte/icons/file-down';
	import image from '#lib/assets/images/application-mobile.jpg?enhanced';
	import { m } from '#lib/paraglide/messages.js';

	const features = [
		{ icon: Smartphone, text: m.app_f1() },
		{ icon: Bell, text: m.app_f2() },
		{ icon: FileDown, text: m.app_f3() }
	];
</script>

<section id="application" class="scroll-mt-24 py-20 sm:py-24">
	<div class="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
		<div class="lg:order-2">
			<enhanced:img
				src={image}
				alt={m.app_image_alt()}
				class="w-full rounded-2xl object-cover"
				sizes="(min-width: 1024px) 40vw, 100vw"
				loading="lazy"
			/>
		</div>

		<div>
			<p class="eyebrow">{m.app_eyebrow()}</p>
			<h2 class="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
				{m.app_title()}
			</h2>
			<p class="mt-4 text-lg text-muted">{m.app_text()}</p>
			<ul class="mt-8 space-y-4">
				{#each features as f (f.text)}
					<li class="flex items-center gap-3">
						<f.icon class="size-5 shrink-0 text-brand" aria-hidden="true" />
						<span>{f.text}</span>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</section>
