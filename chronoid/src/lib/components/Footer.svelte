<script lang="ts">
	import Logo from './Logo.svelte';
	import { navLinks } from '#lib/content.js';
	import { m } from '#lib/paraglide/messages.js';

	const links = navLinks();
</script>

<footer class="bg-ink text-white/70">
	<div
		class="container-page flex flex-col gap-8 border-t border-white/10 py-10 sm:flex-row sm:items-center sm:justify-between"
	>
		<div>
			<Logo inverted />
			<p class="mt-3 text-sm">{m.footer_tagline()}</p>
		</div>
		<nav aria-label={m.footer_nav_label()}>
			<ul class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
				{#each links as link (link.href)}
					<li><a href={link.href} class="hover:text-white">{link.label}</a></li>
				{/each}
			</ul>
		</nav>
	</div>
	<div class="container-page pb-10 text-xs text-white/50">
		{m.footer_rights({ year: new Date().getFullYear() })}
	</div>
</footer>
