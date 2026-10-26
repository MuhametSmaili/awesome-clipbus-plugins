# Extractor

Clipbus plugin that extracts URLs, email addresses, and IP addresses from clipboard text, parses individual URL structure in detail.

## Features

### URL / Email / IP Extraction (`entities-*`)

Automatically detects URLs (http/https), email addresses, and IPv4 addresses in clipboard text. Results are shown in a categorised attachment card.

- **Detector** (`entities-detector`): input kind `text`, attachment type `plugin.extractor.entities`
- **Renderer** (`entities-renderer`): groups results into URLs / Emails / IP Addresses sections; each item is individually copyable and a Copy All button is provided

### URL Structure Parser (`url-*`)

Detects a URL or an unambiguous naked query string on the clipboard and renders a structured breakdown.

- **Detector** (`url-detector`): recognizes URLs and naked query strings with at least two `key=value` pairs
- **Renderer** (`url-parsed`): displays URL components or query pairs in one URL Details card; duplicate query pairs are preserved and the JSON representation is copyable
- **Tracking cleaner**: when the URL contains known tracking parameters (`utm_*`, `fbclid`, `gclid`, `msclkid`, and [30+ others](src/features/url-parsed/payload.ts)), a highlighted banner shows how many were found and displays the clean URL with those params stripped. Tracker rows in the query table are visually flagged. A "Copy clean URL" button appears alongside the existing "Copy query params (JSON)" button.

### IP Address Details (`ip-*`)

Detects when the clipboard contains a single IPv4, IPv4 CIDR, IPv6, or IPv6 CIDR address (no surrounding prose) and renders a rich info card.

- **Detector** (`ip-detector`): input kind `text`, attachment type `plugin.extractor.ip`
- **Renderer** (`ip-details`): for a plain IPv4 shows integer, hex, binary, reverse-DNS pointer, scope (Private / Public / Loopback / …), and legacy class; for a CIDR adds netmask, wildcard mask, network/broadcast addresses, first/last usable host, and total/usable counts; for IPv6 shows expanded and compressed forms plus scope

### Geo Coordinates (`geo-*`)

Detects when the clipboard contains a single latitude/longitude pair (decimal, with optional degree signs or hemisphere letters) and renders a breakdown card.

- **Detector** (`geo-detector`): input kind `text`, attachment type `plugin.extractor.geo`
- **Renderer** (`geo-coordinates`): displays decimal pair, latitude and longitude in DMS notation, hemisphere summary, and copyable OpenStreetMap and Google Maps URLs

### MAC Address Inspector (`mac-*`)

Detects when the clipboard contains a single MAC-48 / EUI-48 address in colon (`00:1A:2B:3C:4D:5E`), hyphen (`00-1A-2B-3C-4D-5E`), or Cisco-dot (`001A.2B3C.4D5E`) notation and renders a structured breakdown.

- **Detector** (`mac-detector`): input kind `text`, attachment type `plugin.extractor.mac`; requires an explicit separator — bare 12-hex strings and prose are rejected
- **Renderer** (`mac-address`): displays all five normalized forms (colon-lower, colon-upper, hyphen, Cisco-dot, bare) with copy buttons; shows OUI / NIC split, cast (Unicast / Multicast), administration (Universal / Locally administered), and a special note for broadcast (`FF:FF:FF:FF:FF:FF`) and null-address (`00:00:00:00:00:00`) inputs

### UUID Inspector (`uuid-*`)

Detects when the clipboard contains a single UUID in any standard form — plain (`8-4-4-4-12` hex), braced (`{…}`), or URN (`urn:uuid:…`) — and renders a structured breakdown.

- **Detector** (`uuid-detector`): input kind `text`, attachment type `plugin.extractor.uuid`; normalises to lowercase canonical form; rejects bare 32-hex blobs and prose
- **Renderer** (`uuid-details`): displays canonical form and URN with copy buttons; version number with description (v1 Time-based through v8 Custom); RFC 4122/9562 variant classification; embedded timestamp (ISO 8601) decoded from v1 (60-bit Gregorian) and v7 (48-bit Unix ms) UUIDs; node address (v1 only) formatted as `XX:XX:XX:XX:XX:XX`; Nil and Max UUID special labels

## Development

```sh
npm install
npm run dev       # Vite preview workbench
npm run verify    # typecheck + lint + build + tests
```
