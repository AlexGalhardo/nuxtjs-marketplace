export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo('/login')
  }
  if (user.value?.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
})
