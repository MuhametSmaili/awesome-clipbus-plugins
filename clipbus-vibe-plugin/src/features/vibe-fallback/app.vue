<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { ctx } from "@clipbus/plugin-sdk/view";
import { useCard, stopOnUnmount } from "../../shared/composables/useCard";
import { decodeVibePayload, vibeAttachment } from "./payload";
import { ANIMATIONS } from "./animations/index";
import type { VibeAnimationInstance } from "./animations/types";
import { resolveAnimationList, buildButtons, indexForButton, type AnimationMeta } from "./switching";

// User-configurable animation list. Read-only setting (host writes, plugin reads).
// The host stores plugin.vibe.animations and returns it as values.animations.
// Value = a JSON array of animation ids (or a comma/space-separated
// string), e.g. ["text-loop","particle-core"]. Only the listed animations are
// shown (one button each, in order) and the FIRST is displayed on load. Unset or
// invalid -> all animations in default order.
const ALL_METAS: AnimationMeta[] = ANIMATIONS.map((a) => ({ id: a.id, label: a.label }));

const { attachment, env } = useCard(vibeAttachment);
const payload = computed(() => decodeVibePayload(attachment.value.payload));

const stageEl = ref<HTMLElement | null>(null);
const activeList = ref<AnimationMeta[]>(ALL_METAS);
const index = ref(0);
let instance: VibeAnimationInstance | null = null;
let disposed = false;

function mount() {
  instance?.dispose(); instance = null;
  const host = stageEl.value;
  const id = activeList.value[index.value]?.id;
  const anim = ANIMATIONS.find((a) => a.id === id);
  if (disposed || !host || !anim || !payload.value) return;
  instance = anim.create({ container: host, text: payload.value?.text ?? "" });
  instance.start();
}

// Push the native button bar once (one enabled button per listed animation).
async function pushButtons() {
  try {
    await ctx.renderer.update({ buttons: buildButtons(activeList.value) });
  } catch (error) {
    ctx.log.warn("Vibe buttons could not be updated", error);
  }
}

function switchTo(buttonID: string) {
  const next = indexForButton(activeList.value, buttonID, index.value);
  if (next === index.value) { instance?.replay(); return; }
  index.value = next;
  mount();
}

async function readAnimationsSetting(): Promise<unknown> {
  try {
    const { values } = await ctx.settings.get<{ animations?: unknown }>();
    return values.animations;
  } catch {
    return null;
  }
}

async function init() {
  const setting = await readAnimationsSetting();
  if (disposed) return;
  activeList.value = resolveAnimationList(setting, ALL_METAS);
  index.value = 0;                 // default shows the first listed animation
  mount();
  void pushButtons();
}

stopOnUnmount(ctx.renderer.onButton((event) => switchTo(event.id)));
onMounted(() => { void init(); });
watch(payload, () => mount());   // 切换剪贴板项时重建（保留当前选择的动画）
onUnmounted(() => {
  disposed = true;
  instance?.dispose(); instance = null;
});
</script>

<template>
  <main class="shell" :lang="env.locale" :data-scheme="env.theme.scheme">
    <div ref="stageEl" class="stage"></div>
  </main>
</template>

<style scoped>
.shell {
  position: relative; width: 100%; height: 100%; padding: 0; overflow: hidden;
  background: transparent;
}
.stage {
  position: absolute; inset: 0;
  /* 动画卡的深色"太空"背景：情绪动画视觉本质（经设计批准的例外） */
  background: radial-gradient(120% 120% at 50% 38%, #0b0b1a 0%, #06060d 55%, #030308 100%);
}
.stage :deep(canvas) { display: block; width: 100% !important; height: 100% !important; }
</style>
