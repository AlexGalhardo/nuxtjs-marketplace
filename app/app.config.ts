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
		// Form fields are square everywhere (owner request, 2026-09-26): terminal prompts, not pills.
		input: {
			slots: {
				base: 'rounded-none',
			},
		},
		textarea: {
			slots: {
				base: 'rounded-none',
			},
		},
		selectMenu: {
			slots: {
				base: 'rounded-none',
			},
		},
		select: {
			slots: {
				base: 'rounded-none',
			},
		},
		// Alerts and empty states are quiet: a solid brand block was loud in light and glaring in dark.
		alert: {
			defaultVariants: {
				variant: 'subtle',
			},
		},
		badge: {
			slots: {
				base: 'rounded-md font-semibold',
			},
		},
	},
})
