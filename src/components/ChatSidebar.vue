<template>
  <nav
    class="w-14 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col items-center py-3 gap-1"
    aria-label="Main navigation"
  >
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      :title="tab.label"
      :aria-label="tab.label"
      :aria-current="store.activeTab === tab.id ? 'page' : undefined"
      @click="store.setActiveTab(tab.id)"
      :class="[
        'w-10 h-10 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors',
        store.activeTab === tab.id
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
      ]"
    >
      <!-- Dashboards: bar chart icon -->
      <svg
        v-if="tab.id === 'dashboards'"
        class="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path stroke-linecap="round" d="M6 18V8M12 18V4M18 18v-6" />
      </svg>

      <!-- Letter badges for portal tabs -->
      <span
        v-else
        :class="[
          'text-[10px] font-bold leading-none tracking-tight',
          tab.id === 'sla_targets' || tab.id === 'sla_performance' ? 'text-[9px]' : '',
        ]"
        aria-hidden="true"
      >
        {{ tab.abbr }}
      </span>
    </button>
  </nav>
</template>

<script>
import { store } from '../store.js';

export default {
  name: 'ChatSidebar',
  data() {
    return {
      tabs: [
        { id: 'dashboards', label: 'Dashboards', abbr: 'D' },
        { id: 'users', label: 'Users', abbr: 'U' },
        { id: 'sla_targets', label: 'SLA Targets', abbr: 'ST' },
        { id: 'sla_performance', label: 'SLA Performance', abbr: 'SP' },
        { id: 'tenants', label: 'Tenants', abbr: 'TN' },
      ],
    };
  },
  computed: {
    store() {
      return store;
    },
  },
};
</script>
