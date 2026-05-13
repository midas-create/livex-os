"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-900 transition-colors outline-none",
        "placeholder:text-slate-400",
        "focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-200/60",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-700",
        "aria-invalid:border-red-400 aria-invalid:ring-2 aria-invalid:ring-red-200",
        className
      )}
      {...props}
    />
  )
}

export { Input }
