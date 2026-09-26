import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AppLogo from '~/components/AppLogo.vue'

describe('AppLogo', () => {
	it('renders the brand name as text so it is readable by screen readers', async () => {
		const wrapper = await mountSuspended(AppLogo)

		expect(wrapper.text()).toBe('resell.sh')
	})

	it('is static: no blinking terminal cursor', async () => {
		const wrapper = await mountSuspended(AppLogo)

		expect(wrapper.find('[aria-hidden="true"]').exists()).toBe(false)
		expect(wrapper.html()).not.toContain('rs-cursor')
	})
})
