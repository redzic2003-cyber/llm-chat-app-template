<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { contactHref } from '#lib/site.js';
	import heroImage from '#lib/assets/images/bureau-badgeuse.jpg?enhanced';
</script>

<section class="relative overflow-hidden bg-white">
	<!-- Photo plein cadre à droite sur grand écran, comme sur la maquette -->
	<div class="absolute inset-y-0 right-0 hidden w-[52%] lg:block">
		<enhanced:img
			src={heroImage}
			alt={m.hero_image_alt()}
			class="size-full object-cover object-[60%_center]"
			sizes="52vw"
			fetchpriority="high"
		/>
		<div class="absolute inset-y-0 left-0 w-40 bg-linear-to-r from-white to-transparent"></div>
	</div>

	<div class="relative container-page">
		<div class="max-w-xl pt-28 pb-14 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-28">
			<p class="eyebrow">{m.hero_eyebrow()}</p>
			<h1 class="mt-5 text-4xl leading-[1.04] display text-balance sm:text-5xl">
				{m.hero_title()}
			</h1>
			<p class="mt-6 max-w-md text-lg leading-relaxed text-muted">
				{m.hero_text()}
			</p>
			<div class="mt-9 flex flex-col gap-3 sm:flex-row">
				<a href={contactHref('demo')} class="btn-dark">{m.hero_cta_demo()}</a>
				<a href="#produits" class="btn-outline">{m.hero_cta_products()}</a>
			</div>
		</div>

		<enhanced:img
			src={heroImage}
			alt=""
			class="mb-10 aspect-[4/3] w-full rounded-2xl object-cover lg:hidden"
			sizes="100vw"
		/>
	</div>
</section>
