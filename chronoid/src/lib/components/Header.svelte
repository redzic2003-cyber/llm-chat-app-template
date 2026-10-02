<script lang="ts">
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import Logo from './Logo.svelte';
	import { navLinks } from '#lib/content.js';

	let open = $state(false);
</script>

<header class="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur">
	<div class="container-page flex h-16 items-center justify-between gap-6">
		<a href="/" aria-label="chronoID, accueil">
			<Logo />
		</a>

		<nav aria-label="Navigation principale" class="hidden md:block">
			<ul class="flex items-center gap-8 text-sm text-ink-soft">
				{#each navLinks as link (link.href)}
					<li><a href={link.href} class="transition-colors hover:text-brand">{link.label}</a></li>
				{/each}
			</ul>
		</nav>

		<div class="flex items-center gap-2">
			<a href="#demo" class="btn-dark hidden px-4 py-2 md:inline-flex">Contact</a>
			<button
				type="button"
				class="rounded-md p-2 md:hidden"
				aria-expanded={open}
				aria-controls="menu-mobile"
				aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
				onclick={() => (open = !open)}
			>
				{#if open}<X class="size-6" />{:else}<Menu class="size-6" />{/if}
			</button>
		</div>
	</div>

	{#if open}
		<nav id="menu-mobile" aria-label="Navigation mobile" class="border-t border-line md:hidden">
			<ul class="container-page flex flex-col py-2">
				{#each navLinks as link (link.href)}
					<li>
						<a href={link.href} class="block py-3 text-base" onclick={() => (open = false)}>
							{link.label}
						</a>
					</li>
				{/each}
				<li class="py-3">
					<a href="#demo" class="btn-dark w-full" onclick={() => (open = false)}>Contact</a>
				</li>
			</ul>
		</nav>
	{/if}
</header>
