// Installing the game as an app: registering the service worker
// (src/service-worker.js, built into sw.js), which caches the game so it plays
// offline, and the menu's Install button where the browser offers one.

// Not in TypeScript's DOM types: Chrome's and Edge's install prompt.
interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
}

export function setUpPwa(): void {
  // There is no sw.js in `npm run dev`, and caching would get in the way of hot reload.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // The game works without it, just not offline.
    });
  }

  const button = document.getElementById('install') as HTMLButtonElement;
  let offer: InstallPromptEvent | null = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    offer = e as InstallPromptEvent;
    button.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    offer = null;
    button.hidden = true;
  });
  button.onclick = () => {
    // The browser offers its prompt only once.
    offer?.prompt().catch(() => {});
    offer = null;
    button.hidden = true;
  };
}
