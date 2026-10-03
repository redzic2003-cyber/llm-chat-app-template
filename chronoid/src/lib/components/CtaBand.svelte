<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { m } from '#lib/paraglide/messages.js';
	import { contactHref } from '#lib/site.js';
</script>

<section class="bg-ink text-white">
	<div
		class="container-page flex flex-col gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="max-w-2xl">
			<h2 class="text-3xl title text-balance sm:text-4xl">{m.cta_title()}</h2>
			<p class="mt-4 text-lg text-white/70">{m.cta_text()}</p>
		</div>
		<div class="flex shrink-0 flex-col gap-3 sm:flex-row">
			<a href={contactHref('demo')} class="btn-brand">
				{m.cta_demo()}
				<ArrowRight class="size-4" aria-hidden="true" />
			</a>
			<a
				href={contactHref('question')}
				class="btn border border-white/25 text-white hover:bg-white/10"
			>
				{m.cta_expert()}
			</a>
		</div>
	</div>
</section>
