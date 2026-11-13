import { App } from './app';
import { setUpPwa } from './pwa';

const app = new App();
app.start();
setUpPwa();
// For poking at the game from the console and from tests in a browser.
if (import.meta.env.DEV) Object.assign(window, { app });
