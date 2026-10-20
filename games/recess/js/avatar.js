// Player Avatar and Profile Management for RECESS

export const AVATAR_OPTIONS = [
  { id: 'pencil', icon: '✏️', name: 'Sharp Pencil' },
  { id: 'specs', icon: '👓', name: 'Geek Specs' },
  { id: 'plane', icon: '✈️', name: 'Paper Plane' },
  { id: 'backpack', icon: '🎒', name: 'School Bag' },
  { id: 'cat', icon: '🐱', name: 'Desk Cat' },
  { id: 'soccer', icon: '⚽', name: 'Recess Ball' },
  { id: 'apple', icon: '🍎', name: 'Tiffin Apple' },
  { id: 'rocket', icon: '🚀', name: 'Notebook Rocket' },
  { id: 'star', icon: '⭐', name: 'Gold Star' },
  { id: 'palette', icon: '🎨', name: 'Art Class' }
];

export class PlayerProfile {
  constructor() {
    this.name = localStorage.getItem('recess_name') || this.randomName();
    this.avatar = localStorage.getItem('recess_avatar') || '✏️';
  }

  randomName() {
    const names = ['Aarav', 'Diya', 'Kabir', 'Ananya', 'Rohan', 'Ishaan', 'Meera', 'Vihaan', 'Aditi', 'Dev'];
    return names[Math.floor(Math.random() * names.length)];
  }

  setName(name) {
    this.name = (name || 'School Kid').slice(0, 15).trim();
    localStorage.setItem('recess_name', this.name);
  }

  setAvatar(icon) {
    this.avatar = icon;
    localStorage.setItem('recess_avatar', this.avatar);
  }

  get() {
    return {
      name: this.name,
      avatar: this.avatar
    };
  }
}

export const profile = new PlayerProfile();
