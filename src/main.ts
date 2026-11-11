import { App } from './app';

const app = new App();
app.start();
// For poking at the game from the console and from tests in a browser.
if (import.meta.env.DEV) Object.assign(window, { app });
