import { startFakeStripe } from '../integration/helpers/fake-stripe'

// Playwright's webServer points the app's Stripe SDK here (playwright.config.ts), so checkout
// e2e runs without real Stripe keys. Returning the closer makes it Playwright's teardown.
export default function globalSetup(): () => void {
	const server = startFakeStripe()
	return () => server.close()
}
