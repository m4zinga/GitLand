/** Theme catalogue: names, one-line pitch and color palette for each wallpaper in scenes.js. */
const THEMES = [
  {
    id: 'night', name: 'GitLand Night', pitch: 'The moonlit landscape of the GitLand logo.',
    palette: {
      base: [8, 18, 42], border: [166, 178, 198], overlay: [4, 10, 28, 0.3],
      fg: '#eef3fa', fgMuted: '#a9b6ca', accent: '#9cc3ff',
      graph: ['rgba(238, 243, 250, 0.08)', '#1d3a6e', '#2f5fae', '#5b8fe0', '#b4d2ff']
    }
  },
  {
    id: 'aurora', name: 'Aurora', pitch: 'Northern lights over a frozen pine forest.',
    palette: {
      base: [3, 20, 30], border: [94, 234, 212], overlay: [1, 8, 14, 0.28],
      fg: '#e8fbf8', fgMuted: '#9fc7c4', accent: '#5eead4',
      graph: ['rgba(232, 251, 248, 0.08)', '#0f4a4a', '#13806f', '#2dd4bf', '#a7f3d0']
    }
  },
  {
    id: 'synthwave', name: 'Synthwave', pitch: 'A striped retro sun setting over a neon grid.',
    palette: {
      base: [24, 6, 44], border: [255, 126, 219], overlay: [10, 0, 24, 0.35],
      fg: '#fdf2ff', fgMuted: '#d9addf', accent: '#ff7edb',
      graph: ['rgba(253, 242, 255, 0.08)', '#4b1470', '#8f2a9c', '#e0389b', '#ffb86c']
    }
  },
  {
    id: 'sakura', name: 'Sakura', pitch: 'Cherry blossoms at dusk over a quiet lake.',
    palette: {
      base: [34, 14, 38], border: [255, 167, 196], overlay: [20, 8, 26, 0.3],
      fg: '#fff3f6', fgMuted: '#e6bccb', accent: '#ffa7c4',
      graph: ['rgba(255, 243, 246, 0.09)', '#5a2147', '#94386b', '#e26d9a', '#ffc2d4']
    }
  },
  {
    id: 'abyss', name: 'Abyss', pitch: 'Bioluminescent jellyfish in the deep sea.',
    palette: {
      base: [2, 16, 28], border: [77, 217, 255], overlay: [0, 6, 14, 0.3],
      fg: '#e0fbff', fgMuted: '#93c4cf', accent: '#4dd9ff',
      graph: ['rgba(224, 251, 255, 0.08)', '#073b55', '#0b6c8c', '#14a9cf', '#7cf2ff']
    }
  },
  {
    id: 'ember', name: 'Ember', pitch: 'A volcano glowing in the night.',
    palette: {
      base: [22, 7, 5], border: [255, 155, 84], overlay: [8, 2, 2, 0.35],
      fg: '#fff1e6', fgMuted: '#d8a994', accent: '#ff9b54',
      graph: ['rgba(255, 241, 230, 0.08)', '#4f160a', '#94300f', '#e2561b', '#ffc15e']
    }
  }
];

module.exports = { THEMES };
