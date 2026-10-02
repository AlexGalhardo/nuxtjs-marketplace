<script setup lang="ts">
import {
	ConnectionMode,
	type Edge,
	Handle,
	MarkerType,
	type Node,
	Panel,
	Position,
	useVueFlow,
	VueFlow,
} from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'

const props = defineProps<{ diagram: SystemDesignDiagram; describedBy?: string }>()

const sides = [Position.Top, Position.Right, Position.Bottom, Position.Left]
const { zoomIn, zoomOut, fitView } = useVueFlow(props.diagram.id)

const nodes: Node[] = props.diagram.nodes.map((node) => ({
	id: node.id,
	type: 'system',
	position: { x: node.x, y: node.y },
	data: node,
	class: ['rs-flow-node', `rs-flow-node--${node.kind}`, node.planned && 'rs-flow-node--planned']
		.filter(Boolean)
		.join(' '),
}))

const edges: Edge[] = props.diagram.edges.map((edge) => ({
	id: `${edge.from}-${edge.to}`,
	source: edge.from,
	target: edge.to,
	// Loose connection mode: every handle is a "source", so an edge may leave or enter any side.
	sourceHandle: edge.fromSide ?? 'right',
	targetHandle: edge.toSide ?? 'left',
	label: edge.label,
	type: 'smoothstep',
	markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--ui-text-muted)' },
}))
</script>

<template>
	<figure class="h-full" :aria-label="`${diagram.title} diagram`" :aria-describedby="describedBy">
		<VueFlow
			:id="diagram.id"
			:nodes="nodes"
			:edges="edges"
			:connection-mode="ConnectionMode.Loose"
			:nodes-draggable="false"
			:nodes-connectable="false"
			:nodes-focusable="false"
			:edges-focusable="false"
			:elements-selectable="false"
			:zoom-on-scroll="false"
			:prevent-scrolling="false"
			:min-zoom="0.2"
			:max-zoom="2"
			fit-view-on-init
			class="rs-flow"
		>
			<template #node-system="{ data }">
				<Handle
					v-for="side in sides"
					:id="side"
					:key="side"
					type="source"
					:position="side"
					:connectable="false"
					class="rs-flow-handle"
				/>
				<span class="block font-semibold text-highlighted">{{ data.label }}</span>
				<span
					v-if="data.detail"
					class="mt-0.5 block font-mono text-[0.6875rem] text-muted normal-case"
					>{{
						data.detail
					}}</span
				>
			</template>

			<Panel position="bottom-right" class="flex gap-1">
				<UButton
					icon="i-lucide-plus"
					color="neutral"
					variant="outline"
					size="sm"
					class="rounded-none bg-default"
					aria-label="zoom in"
					@click="zoomIn()"
				/>
				<UButton
					icon="i-lucide-minus"
					color="neutral"
					variant="outline"
					size="sm"
					class="rounded-none bg-default"
					aria-label="zoom out"
					@click="zoomOut()"
				/>
				<UButton
					icon="i-lucide-maximize"
					color="neutral"
					variant="outline"
					size="sm"
					class="rounded-none bg-default"
					aria-label="fit the whole diagram"
					@click="fitView()"
				/>
			</Panel>
		</VueFlow>
	</figure>
</template>
