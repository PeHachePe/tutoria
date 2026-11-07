/** An entry of a navigation menu: a top bar, the side menu or the user menu. */
export interface NavLink {
  readonly path: string;
  readonly label: string;
  /** Material Symbols name. */
  readonly icon: string;
}
