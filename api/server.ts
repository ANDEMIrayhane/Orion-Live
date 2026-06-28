// @ts-nocheck
import appBundle from '../dist/server.cjs';
const app = appBundle.app || appBundle.default || appBundle;
export default app;
