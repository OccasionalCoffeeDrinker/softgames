/**
 * @file Application entry point.
 *
 * Bootstraps the PixiJS application and starts the render loop.
 * All real work is delegated to the Application class.
 */

import { Application } from '@app/bootstrap/Application';

const app = new Application();
app.start().catch((err: unknown) => {
  console.error('[main] Fatal startup error:', err);
});
