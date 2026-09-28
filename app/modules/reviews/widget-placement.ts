export type ReviewWidgetPlacement = {
  id: string;
  productId: string;
  placement: 'section' | 'embed';
};

export function widgetsToRemove(widgets: ReviewWidgetPlacement[]) {
  const keeper = new Map<string, ReviewWidgetPlacement>();
  for (const widget of widgets) {
    const current = keeper.get(widget.productId);
    if (!current || (current.placement !== 'section' && widget.placement === 'section')) {
      keeper.set(widget.productId, widget);
    }
  }
  const keepIds = new Set([...keeper.values()].map((widget) => widget.id));
  return widgets.filter((widget) => !keepIds.has(widget.id)).map((widget) => widget.id);
}
