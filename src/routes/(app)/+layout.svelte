<script lang="ts">
  import Sidebar from "$lib/components/sidebar.svelte";
  import Header from "$lib/components/header.svelte";

  let { data, children } = $props();
  let collapsed = $state(false);
</script>

<div class="flex h-screen overflow-hidden">
  <Sidebar bind:collapsed onToggle={() => (collapsed = !collapsed)} />
  <div class="flex flex-1 flex-col overflow-hidden">
    <Header user={data.user} />
    <main class="flex-1 overflow-y-auto bg-background px-6 py-6">
      <div class="mx-auto w-full max-w-7xl">
        {@render children()}
      </div>
    </main>
  </div>
</div>
