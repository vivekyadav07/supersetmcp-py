<template>
  <div class="flex h-screen w-full overflow-hidden font-sans bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">

    <!-- Mobile: toggle chat drawer only on Dashboards (split layout) -->
    <button
      v-if="isDashboardLayout"
      @click="isSidebarOpen = !isSidebarOpen"
      class="md:hidden fixed bottom-4 right-4 z-50 p-3 bg-indigo-600 text-white rounded-full shadow-lg"
    >
      <svg v-if="!isSidebarOpen" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>

    <!-- Sidebar / Chat Panel -->
    <div :class="chatWrapperClass">
      <ChatPanel />
    </div>

    <!-- Chart area — Dashboards tab only -->
    <div
      v-if="isDashboardLayout"
      class="flex-1 min-w-0 h-full overflow-hidden relative"
    >
      <Dashboard />

      <!-- Overlay for mobile when sidebar is open -->
      <div
        v-if="isSidebarOpen"
        @click="isSidebarOpen = false"
        class="absolute inset-0 bg-black/50 z-30 md:hidden"
      ></div>
    </div>
  </div>
</template>

<script>
import { store } from './store.js';
import ChatPanel from './components/ChatPanel.vue';
import Dashboard from './components/Dashboard.vue';

export default {
  name: 'App',
  components: {
    ChatPanel,
    Dashboard
  },
  data() {
    return {
      isSidebarOpen: false
    };
  },
  computed: {
    store() {
      return store;
    },
    isDashboardLayout() {
      return store.activeTab === 'dashboards';
    },
    chatWrapperClass() {
      if (this.isDashboardLayout) {
        return [
          'absolute md:relative z-40 w-full sm:w-[22rem] lg:w-[26rem] h-full transition-transform duration-300 ease-in-out shrink-0',
          this.isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ];
      }
      return 'relative z-40 flex-1 w-full min-w-0 h-full';
    },
  },
  watch: {
    'store.activeTab'(tab) {
      if (tab !== 'dashboards') {
        this.isSidebarOpen = true;
      }
    },
  },
  mounted() {
    // Check system preference on load
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.store.isDarkMode = true;
      document.documentElement.classList.add('dark');
    }
  }
}
</script>
