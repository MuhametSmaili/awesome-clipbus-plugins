import { forwardConsole, reportInputState } from "@clipbus/plugin-sdk/dom";
forwardConsole();
reportInputState();
import { createApp } from "vue";
import App from "./app.vue";
import "../../shared/base.css";
createApp(App).mount("#app");
