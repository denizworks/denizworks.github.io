// ─────────────────────────────────────────────────────────────
//  Site config: the 3D side of the portfolio.
//  Text content (bio, descriptions, links) lives in index.html.
// ─────────────────────────────────────────────────────────────

export const CONFIG = {
  // Games shown on the three screens. `media` is optional:
  //   { type: 'image', src: 'assets/games/geringi.jpg' }
  //   { type: 'video', src: 'assets/games/geringi.mp4' }   (muted loop)
  // Without media, the screen shows a generated title card.
  games: {
    fatalstrike:  { title: 'FatalStrike',   style: 'psx',    media: { type: 'image', src: 'assets/games/fatalstrike.jpg' } },
    anarchyflips: { title: 'Anarchy Flips', style: 'toon',   media: { type: 'image', src: 'assets/games/anarchyflips.jpg' } },
    geringi:      { title: 'Geringi',       style: 'horror', media: { type: 'image', src: 'assets/games/geringi.jpg' } },
  },

  // Models & shaders: up to three models, one per pedestal, in this order.
  // Every shader works on every model; `shader` is the one it starts with.
  //   name:      shown on the page
  //   shader:    'psx' | 'toon' | 'horror'
  //   src:       path to a .glb (null = placeholder model)
  //   height:    the model is scaled so it is this tall (world units)
  //   fit:       'height' (default) or 'max' = scale by the longest side instead
  //   rotation:  [x, y, z] tilt in degrees, applied before fitting
  //   lift:      raise the model above the pedestal (world units)
  //   rotationY: starting turntable angle in degrees
  //   spin:      turntable speed (0 = still)
  //   pixelated: true for palette / pixel-art textures (no texture filtering)
  //   animation: index of the animation clip to play, or null
  //   exclude:   names of objects in the file to leave out
  models: {
    boxer:   { name: 'Boxer',                 shader: 'psx',    src: 'assets/models/boxer.glb',      height: 1.85, exclude: ['Hands'], rotationY: 0, spin: 0.25, animation: 0 },
    cat:     { name: 'Cat',                   shader: 'toon',   src: 'assets/models/cat.glb',        height: 1.5,  rotationY: 0, spin: 0.25, animation: 0, pixelated: true },
    shotgun: { name: 'Double-barrel shotgun', shader: 'horror', src: 'assets/models/db-shotgun.glb', height: 1.75, fit: 'max', rotation: [-32, 0, 0], lift: 0.2, rotationY: 0, spin: 0.2, animation: 0, pixelated: true },
  },

  // Renders: framed on the gallery wall, in this order. Add or remove entries freely;
  // the gallery grows to fit. Frames match each image's proportions automatically.
  //   src: image path (.jpg / .png / .webp), title + caption: shown beside it
  renders: [
    { src: 'assets/renders/render-1.jpg', title: 'Photorealistic Alien', caption: '' },
    { src: 'assets/renders/render-2.jpg', title: 'Concept for a Sailing Horror Game', caption: '' },
    { src: 'assets/renders/render-3.jpg', title: 'Hellboy Bust', caption: '' },
    { src: 'assets/renders/render-4.jpg', title: 'Kiosk', caption: '' },
    { src: 'assets/renders/render-5.jpg', title: 'Strawberries', caption: '' },
    { src: 'assets/renders/render-6.jpg', title: 'Spider-Man', caption: '' },
  ],
};
