<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	interface Props {
		class?: string;
		variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline';
		children?: Snippet;
	}
	let { class: className, variant = 'default', children }: Props = $props();

	const variants = {
		default: 'bg-secondary text-secondary-foreground',
		success: 'bg-success/15 text-success',
		warning: 'bg-warning/15 text-warning',
		destructive: 'bg-destructive/15 text-destructive',
		outline: 'border border-border text-foreground'
	} as const;
</script>

<span
	class={cn(
		'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
		variants[variant],
		className
	)}
>
	{@render children?.()}
</span>
