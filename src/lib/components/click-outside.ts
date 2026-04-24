export function clickOutside(node: HTMLElement, callback: () => void) {
  function handle(event: MouseEvent) {
    if (node && !node.contains(event.target as Node)) callback();
  }
  document.addEventListener('click', handle, true);
  return {
    destroy() {
      document.removeEventListener('click', handle, true);
    }
  };
}
