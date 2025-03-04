"use client"

import type React from "react"

export function BodyWrapper({
  children,
  className,
}: {
  children: React.ReactNode
  className: string
}) {
  return (
    <body className={className} suppressHydrationWarning>
      {children}
    </body>
  )
}

