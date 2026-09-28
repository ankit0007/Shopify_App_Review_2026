import {describe, expect, it} from 'vitest';
import {widgetsToRemove} from './widget-placement';

describe('review widget placement', () => {
  it('keeps the product section and removes the body embed for the same product', () => {
    expect(widgetsToRemove([
      {id: 'embed', productId: '1', placement: 'embed'},
      {id: 'section', productId: '1', placement: 'section'},
    ])).toEqual(['embed']);
  });

  it('keeps one embed when the merchant has not added a section block', () => {
    expect(widgetsToRemove([
      {id: 'embed', productId: '1', placement: 'embed'},
    ])).toEqual([]);
  });

  it('keeps one section when the block is added more than once', () => {
    expect(widgetsToRemove([
      {id: 'first', productId: '1', placement: 'section'},
      {id: 'second', productId: '1', placement: 'section'},
    ])).toEqual(['second']);
  });
});
