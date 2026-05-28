import { FixedSizeList, type ListChildComponentProps } from 'react-window';

interface VirtualListProps<T> {
  items: T[];
  height: number;
  itemSize: number;
  renderItem: (item: T, index: number) => React.ReactNode;
}

export const VirtualList = <T,>({ items, height, itemSize, renderItem }: VirtualListProps<T>) => {
  const Row = ({ index, style }: ListChildComponentProps) => (
    <div style={style}>{renderItem(items[index], index)}</div>
  );

  return (
    <FixedSizeList height={height} width="100%" itemCount={items.length} itemSize={itemSize}>
      {Row}
    </FixedSizeList>
  );
};
