import type { DefaultSession } from 'next-auth'
import '@auth/core/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      role: 'admin' | 'staff'
      salonId: number
    } & DefaultSession['user']
  }

  interface User {
    role: 'admin' | 'staff'
    salonId: number
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    sid?: string
    uid?: string
    role?: 'admin' | 'staff'
    salonId?: number
  }
}

export {}
