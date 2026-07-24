"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"

import { cn } from "@/lib/utils"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

const Combobox = ComboboxPrimitive.Root

function ComboboxInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <div className="relative w-full">
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        className={cn(
          "w-full min-w-0 rounded-xl border border-transparent bg-[var(--insyt-canvas)] py-3 pr-10 pl-4 text-sm font-medium text-[var(--insyt-black)] transition-all duration-300 ease-fluid outline-none placeholder:font-normal placeholder:text-[var(--insyt-slate)] hover:border-[var(--insyt-border)] hover:bg-white focus:border-[var(--insyt-primary)]/50 focus:bg-white focus:ring-4 focus:ring-[var(--insyt-primary)]/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      <ComboboxPrimitive.Trigger
        data-slot="combobox-trigger"
        className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-[var(--insyt-slate)]"
        tabIndex={-1}
      >
        <ComboboxPrimitive.Icon
          render={
            <ChevronDownIcon className="pointer-events-none size-4 transition-transform duration-300 ease-fluid group-data-[popup-open]:rotate-180" />
          }
        />
      </ComboboxPrimitive.Trigger>
    </div>
  )
}

function ComboboxContent({
  className,
  children,
  emptyMessage = "Nenhum resultado.",
  sideOffset = 8,
  ...props
}: ComboboxPrimitive.Popup.Props & {
  emptyMessage?: string
  sideOffset?: number
}) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        sideOffset={sideOffset}
        className="isolate z-[100] outline-none"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            "z-[100] max-h-[min(24rem,var(--available-height))] w-(--anchor-width) min-w-[12rem] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-2xl border border-[var(--insyt-border)] bg-white p-2 text-[var(--insyt-black)] shadow-2xl shadow-black/10 outline-none duration-200 ease-fluid data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          <ComboboxPrimitive.Empty className="px-3 py-6 text-center text-sm text-[var(--insyt-slate)] empty:hidden">
            {emptyMessage}
          </ComboboxPrimitive.Empty>
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

const ComboboxList = ComboboxPrimitive.List

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-xl py-2.5 pr-10 pl-3 text-sm font-medium outline-none transition-all duration-200 ease-fluid select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-[var(--insyt-canvas-alt)] data-selected:bg-[var(--insyt-primary)]/5 data-selected:text-[var(--insyt-primary)]",
        className
      )}
      {...props}
    >
      <span className="flex flex-1 gap-2">{children}</span>
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="absolute right-3 flex size-4 items-center justify-center text-[var(--insyt-primary)]">
            <CheckIcon className="size-4" />
          </span>
        }
      />
    </ComboboxPrimitive.Item>
  )
}

export { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList }
