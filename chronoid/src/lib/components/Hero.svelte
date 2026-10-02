<script lang="ts">
	import heroImage from '#lib/assets/images/bureau-badgeuse.jpg?enhanced';
</script>

<section class="relative overflow-hidden bg-white">
	<!-- Photo plein cadre à droite sur grand écran, comme sur la maquette -->
	<div class="absolute inset-y-0 right-0 hidden w-[52%] lg:block">
		<enhanced:img
			src={heroImage}
			alt="Une collaboratrice présente son badge sur une borne murale chronoID"
			class="size-full object-cover object-[60%_center]"
			sizes="52vw"
			fetchpriority="high"
		/>
		<div class="absolute inset-y-0 left-0 w-40 bg-linear-to-r from-white to-transparent"></div>
	</div>

	<div class="relative container-page">
		<div class="max-w-xl py-14 sm:py-20 lg:py-28">
			<p class="eyebrow">Simple. Fiable. Évolutif.</p>
			<h1 class="mt-5 text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl">
				La gestion des temps devient un atout.
			</h1>
			<p class="mt-6 max-w-md text-lg leading-relaxed text-muted">
				Optimisez la présence, la planification et les accès de vos équipes avec des bornes de
				badges intuitives.
			</p>
			<div class="mt-9 flex flex-col gap-3 sm:flex-row">
				<a href="#demo" class="btn-dark">Demander une démo</a>
				<a href="#produits" class="btn-outline">Voir les produits</a>
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
