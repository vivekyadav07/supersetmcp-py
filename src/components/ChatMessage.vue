<template>
  <div :class="['flex w-full', msg.role === 'user' ? 'justify-end' : 'justify-start']">
    <div
      :class="[
        'max-w-[85%] rounded-lg p-3 text-sm shadow-sm',
        msg.role === 'user'
          ? 'bg-indigo-600 text-white rounded-br-none'
          : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-none',
      ]"
    >
      <div class="flex items-start gap-2">
        <div v-if="msg.role === 'ai'" class="shrink-0 mt-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p v-if="msg.askedAs && msg.role === 'user'" class="text-[10px] opacity-70 mb-0.5">
            Asked as: {{ msg.askedAs }}
          </p>
          <p class="whitespace-pre-wrap leading-relaxed">{{ msg.content }}</p>

          <div
            v-if="msg.payload && msg.payload.items?.length"
            :class="[
              'mt-2 rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 p-2 text-xs',
              msg.payload.scrollable ? 'max-h-48 overflow-y-auto' : '',
            ]"
          >
            <ul class="space-y-1.5">
              <li
                v-for="(item, i) in msg.payload.items"
                :key="item.id || i"
                class="border-b border-gray-100 dark:border-gray-700 last:border-0 pb-1.5 last:pb-0"
              >
                <pre class="whitespace-pre-wrap font-mono text-[11px] text-gray-600 dark:text-gray-300">{{ formatItem(item) }}</pre>
              </li>
            </ul>
          </div>

          <div v-if="msg.payload?.actions?.length" class="mt-3 flex flex-wrap gap-2">
            <button
              v-for="action in msg.payload.actions"
              :key="action.token"
              type="button"
              @click="$emit('confirm', action)"
              class="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 hover:bg-red-700 text-white"
            >
              {{ action.label }}
            </button>
            <button
              type="button"
              @click="$emit('cancel')"
              class="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>

          <div v-if="msg.chartGenerated" class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            Chart added to dashboard
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChatMessage',
  props: {
    msg: { type: Object, required: true },
  },
  emits: ['confirm', 'cancel'],
  methods: {
    formatItem(item) {
      if (item.email) {
        return `${item.name} <${item.email}> — ${item.role} (${item.status})`;
      }
      if (item.code) {
        return `${item.name} [${item.code}] — ${item.status}`;
      }
      if (item.objective !== undefined) {
        return `${item.name}: ${item.objective} ${item.unit || ''} (${item.period})`;
      }
      if (item.actualValue !== undefined) {
        return `${item.id}: ${item.actualValue} — ${item.status} (${item.periodStart} → ${item.periodEnd})`;
      }
      return JSON.stringify(item);
    },
  },
};
</script>
