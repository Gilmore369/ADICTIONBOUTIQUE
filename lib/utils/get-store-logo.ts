/**
 * Fetch store logo from system_config table (Supabase).
 * Returns the base64 data-URL or null if not configured.
 * Used for PDF generation.
 */
import { createServiceClient } from '@/lib/supabase/service'

export async function getStoreLogo(): Promise<string | null> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'store_logo')
      .single()

    if (error || !data?.value) return null
    return data.value as string
  } catch {
    return null
  }
}
