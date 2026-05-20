<template>
  <select
    :value="store.askedAs"
    @change="onChange"
    class="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
  >
    <option value="manager">Manager</option>
    <option value="executive">Executive</option>
    <option value="employee">Employee</option>
  </select>
</template>

<script>
import { store } from '../store.js';

export default {
  name: 'AskedAsSelect',
  computed: {
    store() {
      return store;
    },
  },
  methods: {
    onChange(e) {
      store.askedAs = e.target.value;
    },
  },
};
</script>
