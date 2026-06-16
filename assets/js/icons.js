/* ============================================================
   icons.js — Set de íconos SVG estilizados (línea, 24x24)
   Uso: icon('cow'), icon('fuel', 20). Devuelve string SVG.
   Sin emojis: todo es trazo coherente y hereda currentColor.
   ============================================================ */

const ICON_PATHS = {
  // navegación / generales
  home:        '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  user:        '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  cow:         '<path d="M4 8c0-2.2 2.2-3.4 3.3-2.2M16.7 5.8C17.8 4.6 20 5.8 20 8"/><path d="M5.5 8c0 5.5 3 11 6.5 11s6.5-5.5 6.5-11c0-2.4-3-3.6-6.5-3.6S5.5 5.6 5.5 8z"/><path d="M9.5 12.5h.01M14.5 12.5h.01"/><path d="M10.5 16c.8.6 2.2.6 3 0"/>',
  trending:    '<path d="M3 17l5-5 4 4 8-8"/><path d="M17 8h4v4"/>',
  settings:    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  plus:        '<path d="M12 5v14M5 12h14"/>',
  arrowUp:     '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown:   '<path d="M12 5v14M6 13l6 6 6-6"/>',
  wallet:      '<path d="M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3M3 7h16a1 1 0 0 1 1 1v3"/><circle cx="17" cy="13" r="1.3"/>',
  bank:        '<path d="M3 10 12 4l9 6M5 10v8M19 10v8M9 10v8M15 10v8M3 20h18"/>',
  coins:       '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3M9 12.9C12.3 12.9 15 11.6 15 10"/><ellipse cx="15" cy="14" rx="6" ry="3"/><path d="M9 17c0 1.7 2.7 3 6 3s6-1.3 6-3v-3"/>',
  chart:       '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  calendar:    '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  download:    '<path d="M12 3v12M7 11l5 5 5-5M4 21h16"/>',
  trash:       '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit:        '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 5l4 4"/>',
  more:        '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  check:       '<path d="M4 12l5 5L20 6"/>',

  // categorías — personal
  utensils:    '<path d="M4 3v7a2 2 0 0 0 2 2 2 2 0 0 0 2-2V3M6 12v9M16 3c-1.5 0-3 1.8-3 5s1.5 4 3 4v9"/>',
  health:      '<path d="M3.5 12h4l2-5 3 9 2-4h5.5"/>',
  fuel:        '<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14"/><path d="M15 9h2.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V8l-3-3"/><path d="M7 8h6"/>',
  house:       '<path d="M3 10 12 3l9 7M5 9v11h14V9"/>',
  plug:        '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>',
  education:   '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/>',
  briefcase:   '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  coffee:      '<path d="M4 9h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h2.5a2.5 2.5 0 0 1 0 5H17"/><path d="M7 5V3M11 5V3"/>',

  // categorías — ganadería
  stethoscope: '<path d="M5 3v6a4 4 0 0 0 8 0V3M5 3H3M13 3h2M9 17v1a4 4 0 0 0 8 0v-3"/><circle cx="18" cy="11" r="2"/>',
  pill:        '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(45 12 12)"/><path d="M9 9l6 6"/>',
  wheat:       '<path d="M12 22V8"/><path d="M12 8c0-2-1.5-3.5-3.5-3.5C8.5 6.5 10 8 12 8zM12 8c0-2 1.5-3.5 3.5-3.5C15.5 6.5 14 8 12 8zM12 13c0-2-1.5-3.5-3.5-3.5C8.5 11.5 10 13 12 13zM12 13c0-2 1.5-3.5 3.5-3.5C15.5 11.5 14 13 12 13z"/>',
  workers:     '<circle cx="9" cy="8" r="3"/><path d="M3 21c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M16 11a3 3 0 0 0 0-6"/><path d="M18 21c0-2.5-1-4-3-4.5"/>',
  tools:       '<path d="M14 7a4 4 0 0 1-5 5l-5 5 2 2 5-5a4 4 0 0 0 5-5z"/><path d="M14 7l3-3 3 3-3 3"/>',
  milk:        '<path d="M8 2h8l-1 4v3l1.5 3v9a1 1 0 0 1-1 1H8.5a1 1 0 0 1-1-1v-9L9 9V6z"/><path d="M7.5 13h9"/>',
  beef:        '<circle cx="12" cy="12" r="9"/><path d="M9 9c0-1.5 1.5-2 3-2s3 .5 3 2-1.5 2-3 2-3 1-3 2.5S10.5 17 12 17"/>',
  birth:       '<path d="M12 21c4-3 7-6 7-10a7 7 0 0 0-14 0c0 4 3 7 7 10z"/><circle cx="12" cy="10" r="2.3"/>',
  cart:        '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2 3h2l2.2 12h11l2-8H6"/>',
  cash:        '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v6M18 9v6"/>',
  skull:       '<path d="M12 3a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14z"/><circle cx="9" cy="11" r="1.3"/><circle cx="15" cy="11" r="1.3"/><path d="M11 16h2"/>',
  dot:         '<circle cx="12" cy="12" r="2.4"/>',
};

function icon(name, size = 24) {
  const p = ICON_PATHS[name] || ICON_PATHS.dot;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

window.icon = icon;
window.ICON_PATHS = ICON_PATHS;
