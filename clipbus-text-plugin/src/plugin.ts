import { definePlugin } from "@clipbus/plugin-sdk/runtime";
import { createSortAction } from "./features/line-tools/sort.ts";
import { createDedupAction } from "./features/line-tools/dedup.ts";
import { createTrimAction } from "./features/line-tools/trim.ts";
import { createStripAnsiAction } from "./features/line-tools/strip-ansi.ts";
import { createReverseLinesAction } from "./features/line-tools/reverse-lines.ts";
import { createReverseCharactersAction } from "./features/line-tools/reverse-characters.ts";
import { createSortCharactersAction } from "./features/line-tools/sort-characters.ts";
import {
  createMinifyJsonAction,
  createPrettyJsonAction,
} from "./features/line-tools/json.ts";

export default definePlugin({
  actions: {
    "text-sort": createSortAction(),
    "text-dedup": createDedupAction(),
    "text-trim": createTrimAction(),
    "text-strip-ansi": createStripAnsiAction(),
    "text-reverse-lines": createReverseLinesAction(),
    "text-reverse-characters": createReverseCharactersAction(),
    "text-sort-characters": createSortCharactersAction(),
    "text-pretty-json": createPrettyJsonAction(),
    "text-minify-json": createMinifyJsonAction(),
  },
});
