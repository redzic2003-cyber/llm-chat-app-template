<script lang="ts">
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import Logo from './Logo.svelte';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import { navLinks } from '#lib/content.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { contactHref, hrefFor } from '#lib/site.js';

	let open = $state(false);
	const links = navLinks();
</script>

<header class="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4">
	<div class="glass mx-auto max-w-7xl rounded-2xl" data-open={open || undefined}>
		<div class="flex h-14 items-center justify-between gap-6 px-4 sm:px-5">
			<a href={hrefFor('/', getLocale())} aria-label={m.nav_home_label()}>
				<Logo />
			</a>

			<nav aria-label={m.nav_main_label()} class="hidden md:block">
				<ul class="flex items-center gap-8 text-sm text-ink-soft">
					{#each links as link (link.href)}
						<li><a href={link.href} class="transition-colors hover:text-brand">{link.label}</a></li>
					{/each}
				</ul>
			</nav>

			<div class="flex items-center gap-3">
				<LanguageSwitcher class="hidden md:block" />
				<a href={contactHref()} class="btn-dark hidden px-4 py-2 md:inline-flex"
					>{m.nav_contact()}</a
				>
				<button
					type="button"
					class="rounded-md p-2 md:hidden"
					aria-expanded={open}
					aria-controls="menu-mobile"
					aria-label={open ? m.menu_close() : m.menu_open()}
					onclick={() => (open = !open)}
				>
					{#if open}<X class="size-6" />{:else}<Menu class="size-6" />{/if}
				</button>
			</div>
		</div>

		{#if open}
			<nav
				id="menu-mobile"
				aria-label={m.nav_mobile_label()}
				class="border-t border-ink/10 px-4 pb-4 md:hidden"
			>
				<ul class="flex flex-col py-2">
					{#each links as link (link.href)}
						<li>
							<a href={link.href} class="block py-3 text-base" onclick={() => (open = false)}>
								{link.label}
							</a>
						</li>
					{/each}
				</ul>
				<div class="flex items-center justify-between gap-4">
					<LanguageSwitcher />
					<a href={contactHref()} class="btn-dark px-4 py-2" onclick={() => (open = false)}>
						{m.nav_contact()}
					</a>
				</div>
			</nav>
		{/if}
	</div>
</header>
