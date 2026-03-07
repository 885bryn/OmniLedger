"use client"

import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { useOptionalTheme } from "@/features/theme/theme-provider"

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useOptionalTheme()

  return (
    <Sonner
      theme={theme?.isDark ? "dark" : "light"}
      className="toaster group"
      position="top-right"
      expand={false}
      visibleToasts={4}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group pointer-events-auto rounded-xl border border-border/80 bg-card text-card-foreground shadow-[var(--shadow-surface)] backdrop-blur supports-[backdrop-filter]:bg-card/95",
          content: "grid gap-1 px-4 py-3",
          title: "text-sm font-medium text-card-foreground",
          description: "text-sm text-muted-foreground",
          icon: "mt-0.5 text-muted-foreground",
          success: "border-emerald-500/30",
          warning: "border-amber-500/30",
          error: "border-destructive/30",
          info: "border-border/80",
          loading: "border-border/80",
          default: "border-border/80",
          closeButton:
            "rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
        },
      }}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
