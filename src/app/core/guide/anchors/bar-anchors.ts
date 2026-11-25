/** The pieces of the bars and the side menu, which every screen of an area has. */
export const BAR_ANCHORS = {
  // Bars of every area
  brand: 'brand',
  navExercises: 'nav-exercises',
  help: 'help',
  themeMenu: 'theme-menu',
  languageMenu: 'language-menu',
  userMenu: 'user-menu',
  menuSettings: 'menu-settings',
  menuRegisteredData: 'menu-registered-data',
  menuSignOut: 'menu-sign-out',
  // Bar and side menu of the staff
  menuButton: 'menu-button',
  sideMenu: 'side-menu',
  /** The section «Docencia» of the side menu, with every screen of the teacher. */
  navTeaching: 'nav-teaching',
  /** The section «Administración» of the side menu. */
  navAdministration: 'nav-administration',
  navLive: 'nav-live',
  navHistory: 'nav-history',
  navBank: 'nav-bank',
  navBlocks: 'nav-blocks',
  navGroups: 'nav-groups',
  navUsers: 'nav-users',
  navSystem: 'nav-system',
  navShowcase: 'nav-showcase',
} as const;
