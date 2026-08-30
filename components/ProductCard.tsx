import type { Product } from '@/lib/types';

export default function ProductCard({
  product,
  selected,
  onClick,
}: {
  product: Product;
  selected?: boolean;
  onClick?: () => void;
}) {
  const soldOut = product.stock_status === 'DISCONTINUED';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={soldOut}
      className={`w-full text-left rounded-xl border p-3.5 flex items-center gap-3 transition ${
        selected ? 'border-soda-500 bg-soda-50' : 'border-gray-200 bg-white'
      } ${soldOut ? 'opacity-50' : 'active:scale-[0.99]'}`}
    >
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-100" />
      )}
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{product.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">{product.brand}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-gray-700">
          {product.price.toLocaleString()} {product.currency === 'KRW' ? '원' : product.currency}
        </p>
        {soldOut && <p className="text-[11px] text-rose-400 mt-0.5">품절</p>}
      </div>
    </button>
  );
}
