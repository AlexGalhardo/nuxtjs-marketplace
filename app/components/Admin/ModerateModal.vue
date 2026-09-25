<script setup lang="ts">
import { z } from 'zod'

// Suspend/reinstate confirmation for shops and products. The reason is required: it goes to the
// audit log with the action.
const props = defineProps<{
	title: string
	description: string
	confirmLabel: string
	danger?: boolean
	loading?: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ confirm: [reason: string] }>()

const schema = z.object({ reason: z.string().trim().min(3, 'say why').max(500) })
const state = reactive({ reason: '' })
watch(open, (isOpen) => {
	if (isOpen) state.reason = ''
})
</script>

<template>
	<UModal v-model:open="open" :title="props.title">
		<template #body>
			<UForm
				:schema="schema"
				:state="state"
				class="space-y-4"
				@submit="emit('confirm', state.reason.trim())"
			>
				<p class="text-sm text-toned">{{ props.description }}</p>
				<UFormField
					label="reason"
					name="reason"
					description="kept in the audit log"
					required
				>
					<UTextarea v-model="state.reason" :rows="3" autoresize class="w-full" />
				</UFormField>
				<div class="flex justify-end gap-2">
					<UButton color="neutral" variant="subtle" @click="open = false">cancel</UButton>
					<UButton
						type="submit"
						:color="props.danger ? 'error' : 'primary'"
						:loading="props.loading"
						>{{
							props.confirmLabel
						}}</UButton
					>
				</div>
			</UForm>
		</template>
	</UModal>
</template>
