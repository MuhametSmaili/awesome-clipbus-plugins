import { forwardConsole, reportInputState } from "@clipbus/plugin-sdk/dom";
forwardConsole();
reportInputState();
import { createApp } from "vue";
import App from "./app.vue";
import "../../shared/base.css";
const app = createApp(App);
app.mount("#app");
if (import.meta.hot) import.meta.hot.dispose(() => app.unmount());
