# Micro Config

A clean, friendly configurator for the **Work Louder Creator Micro** (including the Figma edition). Remap keys and knobs, write macros and tune lighting, all in your browser. Nothing to install.

**→ Open it: https://chaotic-joy.github.io/micro-config/**

## What makes it nicer than VIA

- **Record shortcuts.** Click a key, hit *Record a shortcut*, and press the combo on your real keyboard (⌘⇧K, ⌥⌘G…).
- **Figma presets.** Around 45 common Figma actions (Auto layout, Create component, Frame selection, align, zoom…) are one click each, and they map to the right keys on Mac or Windows.
- **Knobs done properly.** Turn left, turn right and press for each knob, on every layer.
- **Readable macros.** Write `Thanks!{Enter}` or `{Cmd+Shift+P}{300ms}deploy{Enter}` instead of editing raw keycodes.
- **Saves as you go.** Every change is written to the Micro right away, so there's no "save" step to forget.
- **Export / import** your whole setup as a JSON file.
- **Demo mode** so you can explore the app without the device plugged in.

## Use it

```sh
python3 -m http.server 8765   # then open http://localhost:8765
```

1. Plug in your Creator Micro.
2. Open the page in **Chrome, Edge, Arc or Brave** on desktop. Safari and Firefox don't support WebHID.
3. Click **Connect Micro** and pick the device.

If it says the device is busy, close the VIA app or any other configurator tab first.

> Your Micro needs VIA-enabled firmware (the stock Work Louder firmware is). If it was flashed with a non-VIA QMK build, flash the `via` keymap first.

## Develop

There's no build step. It's plain HTML, CSS and ES modules. `node test.mjs` runs protocol, keycode and macro checks against a simulated Micro.

| File | What |
| --- | --- |
| `src/via.js` | VIA raw-HID protocol over WebHID (plus keycode translation for old firmware) |
| `src/keycodes.js` | QMK keycodes, labels and Figma presets |
| `src/macros.js` | Macro text ⇄ VIA macro buffer |
| `src/mock.js` | Simulated Micro for demo mode and tests |
| `src/app.js` | The UI |

## Notes

- The layout, custom keycodes and lighting channels come from the official VIA definition for the Micro (`0x574C:0xE6E3`).
- Macros support plain ASCII text, key taps, shortcuts and delays.
- Not affiliated with Work Louder or Figma.

MIT licensed.
