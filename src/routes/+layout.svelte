<script lang="ts">
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "svelte-sonner";
  import "../app.css";
  let { children } = $props();
</script>

<ModeWatcher />
<Toaster richColors closeButton />

{@render children()}
