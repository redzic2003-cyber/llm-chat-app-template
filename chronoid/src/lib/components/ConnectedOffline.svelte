<script lang="ts">
	import Wifi from '@lucide/svelte/icons/wifi';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import image from '#lib/assets/images/connectee-autonome.jpg?enhanced';

	const modes = [
		{
			icon: Wifi,
			title: 'Connectée',
			text: 'Les pointages remontent en temps réel sur votre plateforme, depuis tous vos sites.'
		},
		{
			icon: WifiOff,
			title: 'Autonome',
			text: 'Sans réseau, la borne enregistre tout et synchronise dès que la connexion revient.'
		}
	];
</script>

<section id="solutions" class="scroll-mt-16 py-20 sm:py-24">
	<div class="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
		<enhanced:img
			src={image}
			alt="Deux bornes murales chronoID : l’une connectée au Wi-Fi, l’autre fonctionnant hors ligne"
			class="w-full rounded-2xl object-cover"
			sizes="(min-width: 1024px) 40vw, 100vw"
			loading="lazy"
		/>

		<div>
			<p class="eyebrow">Connectée ou autonome</p>
			<h2 class="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
				Ça fonctionne, même sans connexion.
			</h2>
			<p class="mt-4 text-lg text-muted">
				Choisissez la configuration qui correspond à vos locaux. Aucune donnée n’est perdue.
			</p>

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
