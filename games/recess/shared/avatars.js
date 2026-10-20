// Avatar presets. The server only accepts these ids; the browser draws them (js/art.js).
export const AVATARS = [
  { id: 'specs', name: 'Topper', skin: '#f1c27d', hair: '#3b2a1a', shirt: '#2f6fde', extra: 'specs' },
  { id: 'plaits', name: 'Class Monitor', skin: '#e0ac69', hair: '#1c1c1c', shirt: '#e84393', extra: 'plaits' },
  { id: 'cap', name: 'Cricket Captain', skin: '#c68642', hair: '#2b1d0e', shirt: '#16a085', extra: 'cap' },
  { id: 'bow', name: 'Art Room Star', skin: '#f8d5b0', hair: '#7a4b2a', shirt: '#f39c12', extra: 'bow' },
  { id: 'spiky', name: 'Back Bencher', skin: '#d4a373', hair: '#111111', shirt: '#8e44ad', extra: 'spiky' },
  { id: 'bun', name: 'Science Whiz', skin: '#8d5524', hair: '#1a1110', shirt: '#27ae60', extra: 'bun' },
  { id: 'band', name: 'Sports Day Hero', skin: '#f1c27d', hair: '#a0522d', shirt: '#e0563b', extra: 'band' },
  { id: 'curly', name: 'Daydreamer', skin: '#a1665e', hair: '#2e1a12', shirt: '#2980b9', extra: 'curly' },
  { id: 'pencil', name: 'Doodler', skin: '#ffdbac', hair: '#4a3222', shirt: '#d35400', extra: 'pencil' },
  { id: 'headphones', name: 'Tiffin Thief', skin: '#e0ac69', hair: '#3d2314', shirt: '#34495e', extra: 'headphones' }
];

export const AVATAR_IDS = AVATARS.map(a => a.id);

export const REACTIONS = ['laugh', 'wow', 'cry', 'party', 'angry', 'cool'];

export const MOODS = ['Ready for recess', 'Plotting revenge', 'Just here for tiffin', 'Undefeated (today)', 'Sharpening pencils', 'On a winning streak', 'Hiding from the teacher'];
