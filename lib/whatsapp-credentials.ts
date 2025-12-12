import { settingsDb } from '@/lib/supabase-db'

/**
 * WhatsApp Credentials Helper
 * 
 * Centralizes credential management using Supabase Settings (Primary)
 * and Environment Variables (Fallback).
 */

export interface WhatsAppCredentials {
  phoneNumberId: string
  businessAccountId: string
  accessToken: string
  displayPhoneNumber?: string
  verifiedName?: string
}

/**
 * Get WhatsApp credentials
 * 
 * Priority:
 * 1. Supabase Settings (User configured)
 * 2. Environment Variables (Hardcoded fallback)
 */
export async function getWhatsAppCredentials(): Promise<WhatsAppCredentials | null> {
  try {
    // 1. Try Supabase Settings
    const settings = await settingsDb.getAll()

    // 2. Fallback to Env if missing in DB
    const phoneNumberId = settings.phoneNumberId || process.env.WHATSAPP_PHONE_ID
    const businessAccountId = settings.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
    const accessToken = settings.accessToken || process.env.WHATSAPP_TOKEN

    if (phoneNumberId && businessAccountId && accessToken) {
      return {
        phoneNumberId,
        businessAccountId,
        accessToken,
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching WhatsApp credentials:', error)
    // Fallback to env on error
    const phoneNumberId = process.env.WHATSAPP_PHONE_ID
    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
    const accessToken = process.env.WHATSAPP_TOKEN

    if (phoneNumberId && businessAccountId && accessToken) {
      return {
        phoneNumberId,
        businessAccountId,
        accessToken,
      }
    }
    return null
  }
}

/**
 * Check if WhatsApp is configured
 */
export async function isWhatsAppConfigured(): Promise<boolean> {
  const credentials = await getWhatsAppCredentials()
  return credentials !== null
}

/**
 * Get credentials source (for debugging/UI)
 */
export async function getCredentialsSource(): Promise<'db' | 'env' | 'none'> {
  const settings = await settingsDb.getAll()

  if (settings.phoneNumberId && settings.accessToken) {
    return 'db'
  }

  if (process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TOKEN) {
    return 'env'
  }

  return 'none'
}
