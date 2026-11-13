import { List, type RowComponentProps } from 'react-window';
import type { ReactNode } from 'react';

interface VirtualListProps<T> {
  items: T[];
  height: number;
  itemSize: number;
  renderItem: (item: T, index: number) => ReactNode;
}

type VirtualRowProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
};

export const VirtualList = <T,>({ items, height, itemSize, renderItem }: VirtualListProps<T>) => {
  const Row = ({ index, style, ariaAttributes, items: rows, renderItem: render }: RowComponentProps<VirtualRowProps<T>>) => (
    <div style={style} {...ariaAttributes}>{render(rows[index], index)}</div>
  );

  return (
    <List
      height={height}
      width="100%"
      rowCount={items.length}
      rowHeight={itemSize}
      rowProps={{ items, renderItem }}
      rowComponent={Row}
      overscanCount={3}
    />
  );
};
