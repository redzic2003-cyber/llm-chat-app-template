<script lang="ts">
	import Logo from './Logo.svelte';
	import { navLinks } from '#lib/content.js';
</script>

<footer class="bg-ink text-white/70">
	<div
		class="container-page flex flex-col gap-8 border-t border-white/10 py-10 sm:flex-row sm:items-center sm:justify-between"
	>
		<div>
			<Logo inverted />
			<p class="mt-3 text-sm">Bornes de badges et gestion des temps.</p>
		</div>
		<nav aria-label="Pied de page">
			<ul class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
				{#each navLinks as link (link.href)}
					<li><a href={link.href} class="hover:text-white">{link.label}</a></li>
				{/each}
			</ul>
		</nav>
	</div>
	<div class="container-page pb-10 text-xs text-white/50">
		© {new Date().getFullYear()} chronoID. Tous droits réservés.
	</div>
</footer>
