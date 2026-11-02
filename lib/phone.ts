/** International digits for wa.me / tel: links ("06 12…" in France → 33612…) */
export function phoneDigits(phone: string | null | undefined) {
  if (!phone) return null
  let d = phone.replace(/[^\d+]/g, "")
  if (d.startsWith("+")) d = d.slice(1)
  else if (d.startsWith("00")) d = d.slice(2)
  else if (/^0[1-9]\d{8}$/.test(d)) d = "33" + d.slice(1) // French national format
  return d.length >= 8 ? d : null
}

export const whatsappUrl = (phone: string | null | undefined) => {
  const d = phoneDigits(phone)
  return d ? `https://wa.me/${d}` : null
}

export const telUrl = (phone: string | null | undefined) => {
  const d = phoneDigits(phone)
  return d ? `tel:+${d}` : null
}
