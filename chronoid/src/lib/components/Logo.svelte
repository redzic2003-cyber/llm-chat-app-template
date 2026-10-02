<script lang="ts">
	let { inverted = false, class: className = '' }: { inverted?: boolean; class?: string } =
		$props();
</script>

<span
	class="text-[1.4rem] leading-none font-semibold tracking-tight {inverted
		? 'text-white'
		: 'text-ink'} {className}"
>
	chrono<span class="font-bold text-brand">ID</span>
</span>
