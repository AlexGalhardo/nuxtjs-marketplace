// Nuxt UI re-themed to the resell.sh system (docs/design-system.md). Nuxt UI is kept only for
// accessible primitives; layout and marketing pieces are own Tailwind components in app/components.
export default defineAppConfig({
	ui: {
		colors: {
			primary: 'matrix',
			neutral: 'ink',
		},
		button: {
			slots: {
				base: 'rounded-full font-bold active:scale-[0.97] transition-[color,background-color,transform]',
			},
		},
		input: {
			slots: {
				base: 'rounded-xl',
			},
		},
		textarea: {
			slots: {
				base: 'rounded-xl',
			},
		},
		selectMenu: {
			slots: {
				base: 'rounded-xl',
			},
		},
		select: {
			slots: {
				base: 'rounded-xl',
			},
		},
		badge: {
			slots: {
				base: 'rounded-md font-semibold',
			},
		},
	},
})
