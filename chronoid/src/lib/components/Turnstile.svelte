<script lang="ts" module>
	type TurnstileApi = {
		render: (el: HTMLElement, options: Record<string, unknown>) => string;
		reset: (id?: string) => void;
		remove: (id: string) => void;
	};

	declare global {
		interface Window {
			turnstile?: TurnstileApi;
		}
	}

	let loader: Promise<TurnstileApi> | undefined;

	// Charge le script Cloudflare une seule fois, même après une navigation côté client.
	function loadTurnstile(): Promise<TurnstileApi> {
		loader ??= new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
			script.async = true;
			script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject());
			script.onerror = () => {
				loader = undefined;
				reject(new Error('Turnstile indisponible'));
			};
			document.head.appendChild(script);
		});
		return loader;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	let { siteKey, language }: { siteKey: string; language: string } = $props();

	let container: HTMLDivElement;
	let widgetId: string | undefined;
	let api: TurnstileApi | undefined;

	onMount(() => {
		let cancelled = false;
		loadTurnstile()
			.then((turnstile) => {
				if (cancelled) return;
				api = turnstile;
				// Le jeton est ajouté au formulaire dans un champ caché « cf-turnstile-response ».
				widgetId = turnstile.render(container, { sitekey: siteKey, language, theme: 'light' });
			})
			.catch(() => {});
		return () => {
			cancelled = true;
			if (widgetId) api?.remove(widgetId);
		};
	});

	/** Un jeton ne sert qu'une fois : à appeler après chaque envoi refusé. */
	export function reset() {
		if (widgetId) api?.reset(widgetId);
	}
</script>

<div bind:this={container} class="min-h-[65px]"></div>
