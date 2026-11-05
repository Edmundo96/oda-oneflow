"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { CartTable } from "@/components/pos/CartTable";
import { ProductSearch } from "@/components/pos/ProductSearch";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Icon } from "@/components/ui/Icon";
import { StatusDot } from "@/components/ui/StatusDot";
import { Toast } from "@/components/ui/Toast";
import { categories, products } from "@/data/products";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useToast } from "@/hooks/useToast";
import { currency, normalizeSearch } from "@/lib/format";
import type { CartItem } from "@/types/cart";
import type { Product } from "@/types/product";

const ALL_CATEGORIES = "Todos";
const IVA_RATE = 0.16;
const QUICK_CASH_AMOUNTS = [200, 500];
// Imágenes visibles sin hacer scroll en casi cualquier pantalla: se cargan de inmediato.
const EAGER_IMAGES = 4;

const initialCart: CartItem[] = (
  [
    ["leche", 2],
    ["tortillas", 1],
    ["huevo", 1],
    ["coca-cola", 2],
  ] as const
).flatMap(([id, quantity]) => {
  const product = products.find((item) => item.id === id);
  return product ? [{ product, quantity }] : [];
});

export default function PosPage() {
  const [cart, setCart] = useState<CartItem[]>(initialCart);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const { message: toast, showToast } = useToast();
  const ticketRef = useRef<HTMLElement>(null);

  const cartQuantities = useMemo(
    () => new Map(cart.map((item) => [item.product.id, item.quantity])),
    [cart],
  );

  function availableUnits(product: Product) {
    return product.stock - (cartQuantities.get(product.id) ?? 0);
  }

  function addProduct(product: Product) {
    if (availableUnits(product) <= 0) {
      showToast(
        product.stock === 0
          ? `${product.name} está agotado`
          : `Solo hay ${product.stock} de ${product.name} en existencia`,
        { tone: "error" },
      );
      return;
    }

    setCart((current) =>
      current.some((item) => item.product.id === product.id)
        ? current.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
              : item,
          )
        : [...current, { product, quantity: 1 }],
    );
    showToast(`${product.name} agregado al ticket`, { tone: "success", durationMs: 1800 });
  }

  function addByBarcode(barcode: string) {
    const product = products.find((item) => item.barcode === barcode.trim());
    if (product) {
      addProduct(product);
      setQuery("");
    } else {
      showToast(`No se encontró el código ${barcode}`, { tone: "error", durationMs: 2200 });
    }
  }

  useBarcodeScanner(addByBarcode);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return products.filter((product) => {
      const matchesCategory = category === ALL_CATEGORIES || product.category === category;
      const matchesQuery =
        !normalizedQuery ||
        normalizeSearch(`${product.name} ${product.description} ${product.barcode}`).includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  // Enter en el buscador: código exacto o único resultado se agrega; si no, solo se filtra.
  function submitSearch(value: string) {
    const match =
      products.find((product) => product.barcode === value) ??
      (filteredProducts.length === 1 ? filteredProducts[0] : undefined);

    if (match) {
      addProduct(match);
      setQuery("");
    } else if (!filteredProducts.length) {
      showToast(`Sin resultados para "${value}"`, { tone: "error", durationMs: 2200 });
    }
  }

   function updateQuantity(productId: string, nextQuantity: number) {
    const cartItem = cart.find((item) => item.product.id === productId);

    if (!cartItem) return;

    if (!Number.isFinite(nextQuantity)) return;

    if (nextQuantity > cartItem.product.stock) {
      showToast("Stock insuficiente", { tone: "error" });
      return;
    }

    setCart((current) =>
      nextQuantity <= 0
        ? current.filter((item) => item.product.id !== productId)
        : current.map((item) =>
            item.product.id === productId
              ? { ...item, quantity: Math.min(nextQuantity, item.product.stock) }
              : item,
          ),
    );
  }

  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const netAmount = total / (1 + IVA_RATE);
  const tax = total - netAmount;
  const isCartEmpty = cart.length === 0;

  function chargeSale() {
    showToast(`Demostración: ${currency.format(total)}. No se registró ningún pago.`, { durationMs: 3000 });
  }

  function scrollToTicket() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ticketRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  return (
    <div className="min-h-dvh bg-[#faf8ff] pb-nav text-[#131b2e]">
      <AppHeader subtitle="Punto de Venta" />

      {/* grid-cols explícitas con minmax(0, …): sin ellas la fila de categorías ensancha la columna y la página se desborda en móvil. */}
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-5 py-4 px-safe md:grid-cols-[minmax(0,1fr)_20rem] lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-label="Catálogo de productos" className="min-w-0 space-y-4">
          <ProductSearch onSearch={setQuery} onSubmit={submitSearch} query={query} />
          <div aria-label="Categorías" className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-x-visible">
            {[ALL_CATEGORIES, ...categories].map((item) => (
              <button
                aria-pressed={category === item}
                className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
                  category === item
                    ? "bg-[#00652c] text-white"
                    : "bg-[#eaedff] text-[#283044] hover:bg-[#dae2fd]"
                }`}
                key={item}
                onClick={() => setCategory(item)}
                type="button"
              >
                <CategoryIcon category={item} className="text-base" />
                {item}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 whitespace-nowrap text-lg font-bold">
              <Icon className="text-[#15803d]" name="fast" /> Productos Rápidos
            </h1>
            <span className="hidden whitespace-nowrap text-xs text-[#6f7a6e] min-[360px]:inline">Toca para agregar</span>
          </div>
          {filteredProducts.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product, index) => {
                const available = availableUnits(product);

                return (
                  <button
                    className="min-w-0 overflow-hidden rounded-2xl bg-white p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm disabled:active:scale-100"
                    disabled={available <= 0}
                    key={product.id}
                    onClick={() => addProduct(product)}
                    type="button"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#eaedff]">
                      <Image
                        alt=""
                        className="object-cover"
                        fill
                        loading={index < EAGER_IMAGES ? "eager" : "lazy"}
                        sizes="(min-width: 768px) 220px, (min-width: 640px) 33vw, 50vw"
                        src={product.image}
                      />
                      <span
                        className={`absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 text-xs font-semibold ${
                          available > 0 ? "text-[#00652c]" : "text-[#ba1a1a]"
                        }`}
                      >
                        {available > 0 ? (
                          <>
                            <StatusDot /> {available} disp
                          </>
                        ) : (
                          <>
                            <Icon name="packageOut" /> Agotado
                          </>
                        )}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold">{product.name}</p>
                    <p className="truncate text-xs text-[#6f7a6e]">{product.description}</p>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="truncate font-semibold text-[#15803d]">{currency.format(product.price)}</span>
                      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#95f8a7] text-[#00210a]">
                        <Icon className="text-lg" name="add" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-6 text-center text-sm text-[#6f7a6e]">
              <Icon className="text-3xl" name="notFound" />
              <p>No hay productos para esta búsqueda.</p>
            </div>
          )}
        </section>

        {/* En tablet/escritorio con altura suficiente el ticket queda fijo y solo la lista hace scroll: COBRAR siempre visible. */}
        <section
          aria-label="Ticket de venta"
          className="min-w-0 scroll-mt-20 space-y-3 md:self-start md:tall:sticky md:tall:top-[calc(5rem_+_env(safe-area-inset-top))] md:tall:flex md:tall:max-h-[calc(100dvh_-_10rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] md:tall:flex-col"
          id="ticket"
          ref={ticketRef}
        >
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-md">
            <div className="flex shrink-0 items-center justify-between gap-2 bg-[#f2f3ff] p-4">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 whitespace-nowrap font-bold">
                  <Icon className="text-[#00652c]" name="receipt" /> Ticket #0482
                </h2>
                <p className="text-xs text-[#6f7a6e]">Cliente General · Contado</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="rounded-full bg-[#00652c]/10 px-2 py-1 text-xs font-bold text-[#00652c]">
                  {itemCount} {itemCount === 1 ? "artículo" : "artículos"}
                </span>
                <button
                  aria-label="Limpiar ticket"
                  className="flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#ba1a1a] hover:bg-[#ffdad6] disabled:opacity-50"
                  disabled={isCartEmpty}
                  onClick={() => setCart([])}
                  type="button"
                >
                  <Icon className="text-base" name="delete" />
                  {/* Texto solo cuando el ticket tiene ancho suficiente (móvil ancho o escritorio grande). */}
                  <span className="hidden sm:inline md:hidden xl:inline">Limpiar</span>
                </button>
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
              <CartTable
                items={cart}
                onQuantityChange={updateQuantity}
                onRemove={(productId) => updateQuantity(productId, 0)}
              />
            </div>
            <div className="shrink-0 space-y-2 bg-[#eaedff] p-4 text-sm">
              <div className="flex justify-between text-[#3f493f]">
                <span>Subtotal</span><span>{currency.format(netAmount)}</span>
              </div>
              <div className="flex justify-between text-[#3f493f]">
                <span>IVA incluido (16%)</span><span>{currency.format(tax)}</span>
              </div>
              <div className="flex items-end justify-between gap-2 border-t border-[#dae2fd] pt-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide">Total a cobrar</p>
                  <p className="text-xs text-[#00652c]">{itemCount} piezas registradas</p>
                </div>
                <p className="text-2xl font-extrabold text-[#00652c] sm:text-3xl">{currency.format(total)}</p>
              </div>
            </div>
          </div>
          <p className="flex shrink-0 items-center gap-1.5 px-1 text-xs font-semibold text-[#6f7a6e]">
            <Icon className="text-base text-[#00652c]" name="cash" /> Pago rápido en efectivo
          </p>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4">
            {[total, ...QUICK_CASH_AMOUNTS].map((amount, index) => {
              const isExact = index === 0;
              const change = amount - total;

              return (
                <button
                  className="flex min-w-0 flex-col items-center rounded-xl bg-white px-1 py-3 text-sm shadow-sm hover:bg-[#f2f3ff] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
                  disabled={isCartEmpty || change < 0}
                  key={isExact ? "exact" : amount}
                  onClick={() =>
                    showToast(`Efectivo recibido: ${currency.format(amount)} · Cambio ${currency.format(change)}`, {
                      tone: "success",
                      durationMs: 2500,
                    })
                  }
                  type="button"
                >
                  <strong className="text-[#00652c]">{isExact ? "Exacto" : currency.format(amount)}</strong>
                  <span className="text-[11px] text-[#6f7a6e]">
                    {isExact
                      ? currency.format(amount)
                      : change < 0
                        ? "Insuficiente"
                        : `Cambio ${currency.format(change)}`}
                  </span>
                </button>
              );
            })}
            <button
              className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-white px-1 py-3 text-sm shadow-sm hover:bg-[#f2f3ff] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
              disabled={isCartEmpty}
              onClick={() => showToast("Pago con terminal seleccionado")}
              type="button"
            >
              <Icon className="text-lg text-[#00652c]" name="card" />
              <span className="text-[11px]">Terminal</span>
            </button>
          </div>
          <button
            className="flex min-h-16 w-full shrink-0 items-center justify-between gap-3 rounded-2xl bg-[#15803d] px-4 py-3 text-white shadow-lg transition hover:bg-[#00652c] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isCartEmpty}
            onClick={chargeSale}
            type="button"
          >
            <span className="flex items-center gap-3 text-left">
              <Icon className="text-3xl" name="wallet" />
              <span><strong className="block">COBRAR VENTA</strong><small>Toque para finalizar</small></span>
            </span>
            <strong className="flex shrink-0 items-center gap-1">
              {currency.format(total)} <Icon name="arrow" />
            </strong>
          </button>
        </section>
      </main>

      {/* Resumen siempre visible sobre la navegación cuando el ticket no está fijo (móvil, o pantalla baja en horizontal). */}
      <div className="sticky bottom-[calc(var(--nav-h)_+_env(safe-area-inset-bottom)_+_0.5rem)] z-20 mt-2 px-safe md:tall:hidden">
        <div className="flex items-center gap-2 rounded-2xl bg-[#283044] p-2 pl-3 text-white shadow-xl">
          <button className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left" onClick={scrollToTicket} type="button">
            <Icon className="text-2xl text-white/80" name="receipt" />
            <span className="min-w-0">
              <span className="block truncate text-xs text-white/70">
                {itemCount} {itemCount === 1 ? "artículo" : "artículos"} · Ver ticket
              </span>
              <strong className="block truncate text-lg leading-tight">{currency.format(total)}</strong>
            </span>
          </button>
          <button
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#15803d] px-4 font-semibold transition hover:bg-[#00652c] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isCartEmpty}
            onClick={chargeSale}
            type="button"
          >
            <Icon name="wallet" /> Cobrar
          </button>
        </div>
      </div>

      <Toast message={toast} />
      <BottomNavigation active="pos" />
    </div>
  );
}
