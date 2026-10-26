import type { DetectorHandler } from "@clipbus/plugin-sdk/runtime";
import { attachment, createIpPayload } from "./payload.ts";

export function createIpDetector(): DetectorHandler {
  return async (input, ctx) => {
    const payload = createIpPayload(input);
    if (payload === null) return;
    await attachment.set(ctx, [{ key: "primary", payload }]);
    let searchText: string;
    if (payload.inputType === "ipv4") {
      searchText = `${payload.input} IPv4 ${payload.scope} Class ${payload.legacyClass} ${payload.integer}`;
    } else if (payload.inputType === "ipv4cidr") {
      searchText = `${payload.input} IPv4 CIDR /${payload.prefix} network:${payload.networkAddress} broadcast:${payload.broadcastAddress}`;
    } else if (payload.inputType === "ipv6") {
      searchText = `${payload.input} IPv6 ${payload.scope} ${payload.expanded}`.slice(0, 200);
    } else {
      searchText = `${payload.input} IPv6 CIDR /${payload.prefix} ${payload.networkPrefix}`.slice(0, 200);
    }
    await ctx.item.setSearchExtension({
      scope: "extractor",
      entries: [{ key: "primary", text: searchText, label: "IP Address" }],
    });
  };
}
