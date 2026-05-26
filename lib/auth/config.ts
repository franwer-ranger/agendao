import type { NextAuthConfig } from 'next-auth'

const STAFF_ALLOWED_PREFIXES = ['/admin/today', '/admin/calendar']

function isStaffAllowed(pathname: string): boolean {
  return STAFF_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))
}

export const authConfig = {
  pages: { signIn: '/login' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isAdminRoute = nextUrl.pathname.startsWith('/admin')
      const role = auth?.user?.role
      const isLoggedIn = !!role
      if (!isAdminRoute) return true
      if (!isLoggedIn) return false
      if (role === 'staff' && !isStaffAllowed(nextUrl.pathname)) {
        return Response.redirect(new URL('/admin/today', nextUrl))
      }
      return true
    },
    async session({ session, token }) {
      if (
        token &&
        typeof token.uid === 'string' &&
        (token.role === 'admin' || token.role === 'staff') &&
        typeof token.salonId === 'number'
      ) {
        session.user.id = token.uid
        session.user.role = token.role
        session.user.salonId = token.salonId
      }
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
