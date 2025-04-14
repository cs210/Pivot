"use client"

import type React from "react"

import { useEffect, useState } from "react"

export function ClientBodyClassWrapper({
  children,
  className,
}: {
  children: React.ReactNode
  className: string
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <body>{children}</body>
  }

  return <body className={className}>{children}</body>
}

