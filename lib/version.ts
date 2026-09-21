/**
 * What is actually running.
 *
 * Baked in at image build time by the Dockerfile from `git describe`, so it
 * names a real point in history - "v0.4.0" on a tagged build, or
 * "v0.4.0-3-g902650a" three commits past it. That is the whole point: a
 * version read from package.json would be whatever number was last typed
 * there by hand, which tracks nothing.
 *
 * "dev" locally, where the value is simply absent.
 */
export const APP_VERSION = process.env.APP_VERSION?.trim() || "dev";
