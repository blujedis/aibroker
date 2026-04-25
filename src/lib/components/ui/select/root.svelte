<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  interface Props {
    value?: string;
    name?: string;
    required?: boolean;
    disabled?: boolean;
    onValueChange?: (v: string | undefined) => void;
    children: Snippet;
  }

  let {
    value = $bindable(),
    name,
    required,
    disabled,
    onValueChange,
    children,
  }: Props = $props();
</script>

<SelectPrimitive.Root
  type="single"
  bind:value
  {name}
  {required}
  {disabled}
  {onValueChange}
>
  {@render children()}
</SelectPrimitive.Root>
