import type { CartItem } from "@/types/cart";
import { Icon } from "@/components/ui/Icon";
import { currency } from "@/lib/format";

interface CartTableProps {
  items: CartItem[];
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

export function CartTable({ items, onQuantityChange, onRemove }: CartTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-[#6f7a6e]">
        <Icon className="text-4xl" name="cart" />
        <p>El ticket está vacío. Agrega productos para comenzar.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#f2f3ff]">
      {items.map(({ product, quantity }) => (
        // flex-wrap: en pantallas muy angostas los controles bajan a su propia línea en vez de aplastar el nombre.
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-3 first:pt-0" key={product.id}>
          <div className="min-w-28 flex-1">
            <p className="truncate text-sm font-semibold text-[#131b2e]">{product.name}</p>
            <p className="mt-1 text-xs text-[#6f7a6e]">
              P.U. {currency.format(product.price)} <span className="px-1">·</span>
              <span className="font-semibold text-[#00652c]">
                Total: {currency.format(product.price * quantity)}
              </span>
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <div className="flex items-center rounded-lg bg-[#f2f3ff] p-0.5">
              <button
                aria-label={`Restar una unidad de ${product.name}`}
                className="flex h-10 w-10 items-center justify-center rounded-md bg-white"
                onClick={() => onQuantityChange(product.id, quantity - 1)}
                type="button"
              >
                <Icon name="minus" />
              </button>
              <span aria-live="polite" className="w-8 text-center text-sm">{quantity}</span>
              <button
                aria-label={`Agregar una unidad de ${product.name}`}
                className="flex h-10 w-10 items-center justify-center rounded-md bg-white disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => onQuantityChange(product.id, quantity + 1)}
                title={quantity >= product.stock ? "Sin más existencias" : undefined}
                type="button"
              >
                <Icon name="add" />
              </button>
            </div>
            <button
              aria-label={`Eliminar ${product.name}`}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[#6f7a6e] hover:bg-[#ffdad6] hover:text-[#ba1a1a]"
              onClick={() => onRemove(product.id)}
              type="button"
            >
              <Icon className="text-xl" name="delete" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
