/**
 * What jsdom lacks for the tests. It has no layout, so ranges cannot say where text is drawn:
 * CodeMirror asks for it when it measures the editor after painting it. They answer «nowhere», as
 * an element that is not displayed would.
 */
const emptyRect = (): DOMRect => new DOMRect();
const noRects = (): DOMRectList =>
  ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: [][Symbol.iterator],
  }) as unknown as DOMRectList;

Range.prototype.getBoundingClientRect = emptyRect;
Range.prototype.getClientRects = noRects;
