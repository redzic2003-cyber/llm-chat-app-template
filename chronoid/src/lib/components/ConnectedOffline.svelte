<script lang="ts">
	import Wifi from '@lucide/svelte/icons/wifi';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import image from '#lib/assets/images/connectee-autonome.jpg?enhanced';
	import { m } from '#lib/paraglide/messages.js';

	const modes = [
		{ icon: Wifi, title: m.mode_connected_title(), text: m.mode_connected_text() },
		{ icon: WifiOff, title: m.mode_offline_title(), text: m.mode_offline_text() }
	];
</script>

<section id="solutions" class="scroll-mt-24 py-20 sm:py-24">
	<div class="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
		<enhanced:img
			src={image}
			alt={m.mode_image_alt()}
			class="w-full rounded-2xl object-cover"
			sizes="(min-width: 1024px) 40vw, 100vw"
			loading="lazy"
		/>

		<div>
			<p class="eyebrow">{m.mode_eyebrow()}</p>
			<h2 class="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
				{m.mode_title()}
			</h2>
			<p class="mt-4 text-lg text-muted">{m.mode_text()}</p>

			<ul class="mt-10 space-y-6">
				{#each modes as mode (mode.title)}
					<li class="flex gap-4">
						<span
							class="grid size-11 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"
						>
							<mode.icon class="size-5" aria-hidden="true" />
						</span>
						<div>
							<h3 class="font-semibold">{mode.title}</h3>
							<p class="mt-1 text-muted">{mode.text}</p>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</section>
