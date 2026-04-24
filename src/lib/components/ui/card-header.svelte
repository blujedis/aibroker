<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	interface Props {
		class?: string;
		title?: string;
		description?: string;
		children?: Snippet;
		actions?: Snippet;
	}
	let { class: className, title, description, children, actions }: Props = $props();
</script>

<div class={cn('flex flex-col gap-1.5 border-b border-border px-5 py-4', className)}>
	<div class="flex items-center justify-between gap-2">
		<div>
			{#if title}
				<h3 class="text-base font-semibold leading-none tracking-tight">{title}</h3>
			{/if}
			{#if description}
				<p class="mt-1.5 text-sm text-muted-foreground">{description}</p>
			{/if}
			{@render children?.()}
		</div>
		{#if actions}
			<div class="flex items-center gap-2">{@render actions()}</div>
		{/if}
	</div>
</div>
