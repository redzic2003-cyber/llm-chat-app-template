<script lang="ts">
	// Neue Haas Unica est sous licence : les fichiers sont déposés à la main dans
	// src/lib/assets/fonts/. Ce composant ne déclare que ceux qui sont présents,
	// donc le site retombe proprement sur Inter tant qu'ils manquent.
	const files = import.meta.glob<string>('/src/lib/assets/fonts/NeueHaasUnica-*.woff2', {
		eager: true,
		query: '?url',
		import: 'default'
	});

	const styles: Record<string, { weight: number; italic: boolean }> = {
		Light: { weight: 300, italic: false },
		Regular: { weight: 400, italic: false },
		Italic: { weight: 400, italic: true },
		Medium: { weight: 500, italic: false },
		MediumItalic: { weight: 500, italic: true },
		Bold: { weight: 700, italic: false },
		BoldItalic: { weight: 700, italic: true }
	};

	const faces = Object.entries(files).flatMap(([path, url]) => {
		const style = styles[path.match(/NeueHaasUnica-(\w+)\.woff2$/)?.[1] ?? ''];
		return style ? [{ url, ...style }] : [];
	});

	const css = faces
		.map(
			(f) =>
				`@font-face{font-family:'Neue Haas Unica';src:url('${f.url}') format('woff2');` +
				`font-weight:${f.weight};font-style:${f.italic ? 'italic' : 'normal'};font-display:swap}`
		)
		.join('');

	// Précharge les deux graisses visibles dès l'arrivée (texte et titres).
	const preload = faces.filter((f) => !f.italic && (f.weight === 400 || f.weight === 500));
</script>

<svelte:head>
	{#each preload as f (f.url)}
		<link rel="preload" href={f.url} as="font" type="font/woff2" crossorigin="anonymous" />
	{/each}
	{#if css}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- CSS généré au build à partir de nos propres fichiers -->
		{@html `<style>${css}</style>`}
	{/if}
</svelte:head>
