<template>
  <select
    :value="store.selectedTenantId"
    @change="onChange"
    class="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
    :disabled="store.activeTab === 'tenants' && store.currentUser.role !== 'system_admin'"
  >
    <option v-for="t in store.tenants" :key="t.id" :value="t.id">
      {{ t.name }} ({{ t.code }})
    </option>
  </select>
</template>

<script>
import { store } from '../store.js';

export default {
  name: 'TenantSelect',
  computed: {
    store() {
      return store;
    },
  },
  methods: {
    onChange(e) {
      store.selectedTenantId = e.target.value;
    },
  },
};
</script>
