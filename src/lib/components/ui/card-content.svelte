<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	interface Props {
		class?: string;
		children?: Snippet;
	}
	let { class: className, children }: Props = $props();
</script>

<div class={cn('px-5 py-4', className)}>{@render children?.()}</div>
