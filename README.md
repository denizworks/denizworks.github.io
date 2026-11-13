# denizworks.github.io

Portfolio of Deniz Demir. A small explorable level built with Three.js: scrolling (or the arrow buttons /
arrow keys) walks a character past the games, the models & shaders, a gallery of renders, and on to about and contact.

No build step. Plain HTML, CSS and JavaScript modules. Three.js and the fonts are included in `vendor/` and `fonts/`.

## Run it locally

Browsers block JS modules opened straight from disk, so serve the folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Where things live

| What | File |
| --- | --- |
| All text (bio, game descriptions, links, contact) | `index.html` |
| Model files, renders, game screenshots/trailers | `js/config.js` |
| The three shaders, their descriptions and sliders | `js/shaders/lab-shaders.js` |
| Diorama layout, camera stops, house shading | `js/world.js`, `js/shaders/world-shaders.js` |
| Colors and type | `css/style.css` (top of file) |

## Models & shaders

Up to three models, one per pedestal, listed in `js/config.js` under `models` (in pedestal order).
Every shader (PSX, Toon, Stylized Horror) works on every model: visitors pick one from the dropdown,
and each model keeps its own slider settings per shader. `shader` is the one a model starts with.

1. Export as **.glb** (binary glTF), textures embedded. One animation clip is fine.
2. Put it in `assets/models/`.
3. Add or edit its entry:

```js
models: {
  boxer: { name: 'Boxer', shader: 'psx', src: 'assets/models/boxer.glb', height: 1.85 },
```

Useful options (all optional): `fit: 'max'` scales by the longest side (props), `rotation: [x, y, z]`
tilts the model in degrees, `lift` floats it above the pedestal, `pixelated: true` for palette textures,
`exclude: ['ObjectName']` leaves stray objects out. The page sections are generated from this list.
Visitors can drag a model with the mouse to rotate it.

The base color texture is kept; the model's own material is replaced by the shader.
If a file fails to load, a placeholder shows and the browser console says why.
Keep each .glb under ~10 MB.

## Adding renders

Put images in `assets/renders/` and list them in `js/config.js` under `renders`, in the order they should hang:

```js
renders: [
  { src: 'assets/renders/knight.jpg', title: 'Knight', caption: 'Blender, Cycles. Sculpted and textured for Geringi.' },
],
```

Each render gets its own frame on the gallery wall (sized to the image's proportions), its own stop with a
"View full size" button, and an entry in the Renders list. The gallery grows to fit however many you add.
Keep images around 2000 px on the long side and under ~1 MB each (.jpg or .webp).

## Showing real footage on the game screens

Put an image or a short muted video in `assets/games/` and set `media` in `js/config.js`:

```js
fatalstrike: { title: 'FatalStrike', style: 'psx', media: { type: 'video', src: 'assets/games/fatalstrike.mp4' } },
```

The screen still runs its style shader (PSX dither, halftone, horror flicker) on top.

## Debugging

`window.__portfolio` in the console exposes the renderer, scene, camera, lab and `setViewMode(n)`.
