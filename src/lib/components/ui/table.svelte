<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLTableAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	interface Props extends HTMLTableAttributes {
		class?: string;
		children?: Snippet;
	}
	let { class: className, children, ...rest }: Props = $props();
</script>

<div class="w-full overflow-x-auto">
	<table class={cn('w-full caption-bottom text-sm', className)} {...rest}>
		{@render children?.()}
	</table>
</div>
