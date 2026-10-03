<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ContactForm from '#lib/components/ContactForm.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { CONTACT_EMAIL } from '#lib/site.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const points = [m.contact_point_1(), m.contact_point_2(), m.contact_point_3()];
</script>

<svelte:head>
	<title>{m.contact_meta_title()}</title>
	<meta name="description" content={m.contact_meta_description()} />
</svelte:head>

<section class="bg-surface pt-28 pb-20 sm:pt-32 lg:pt-40 lg:pb-28">
	<div class="container-page grid gap-12 lg:grid-cols-[2fr_3fr] lg:gap-20">
		<div>
			<p class="eyebrow">{m.contact_eyebrow()}</p>
			<h1 class="mt-5 text-4xl leading-[1.04] display text-balance sm:text-5xl">
				{m.contact_title()}
			</h1>
			<p class="mt-6 text-lg leading-relaxed text-muted">{m.contact_text()}</p>

			<ul class="mt-10 space-y-4">
				{#each points as point (point)}
					<li class="flex items-center gap-3">
						<span
							class="grid size-7 shrink-0 place-items-center rounded-full bg-brand/10 text-brand"
						>
							<Check class="size-4" aria-hidden="true" />
						</span>
						{point}
					</li>
				{/each}
			</ul>

			<p class="mt-10 text-sm text-muted">
				{m.contact_direct()}
				<a href="mailto:{CONTACT_EMAIL}" class="font-medium text-ink underline underline-offset-4"
					>{CONTACT_EMAIL}</a
				>
			</p>
		</div>

		<div class="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-10">
			<ContactForm {form} topic={data.topic} turnstileSiteKey={data.turnstileSiteKey} />
		</div>
	</div>
</section>
