"use client"

import { useEffect, useState } from "react"

/**
 * Height of the area actually visible above the on-screen keyboard (mobile only).
 * iOS often slides the whole page up instead of resizing it: sizing the chat to the visual
 * viewport keeps the text field right above the keyboard and the latest messages just above it,
 * like WhatsApp or Instagram. Returns null on desktop or when the API is missing.
 */
export function useKeyboardViewport() {
  const [height, setHeight] = useState<number | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      if (window.innerWidth >= 768) return setHeight(null)
      setHeight(Math.round(vv.height))
      // undo the page shift iOS applies when focusing a field: the layout already fits
      if (window.scrollY !== 0) window.scrollTo(0, 0)
    }
    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [])
  return height
}
