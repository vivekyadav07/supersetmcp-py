<template>
  <div
    class="w-full px-1 pb-2 pt-2 border-t border-gray-200 dark:border-gray-800 shrink-0"
    title="Signed-in user"
  >
    <div
      class="w-10 mx-auto rounded-lg bg-gray-100 dark:bg-gray-800 p-1.5 text-center"
    >
      <div
        class="w-7 h-7 mx-auto rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center"
      >
        {{ initials }}
      </div>
      <p class="mt-1 text-[8px] leading-tight text-gray-600 dark:text-gray-300 truncate max-w-full" :title="displayName">
        {{ shortName }}
      </p>
      <p class="text-[7px] text-gray-400 truncate" :title="userIdLabel">{{ shortUserId }}</p>
    </div>
    <button
      type="button"
      @click="logout"
      class="mt-1 w-full text-[8px] text-gray-500 hover:text-red-500 dark:hover:text-red-400"
    >
      Sign out
    </button>
  </div>
</template>

<script>
import { store } from '../store.js';

export default {
  name: 'UserProfileFooter',
  computed: {
    user() {
      return store.currentUser;
    },
    displayName() {
      return this.user?.name || 'User';
    },
    shortName() {
      const n = this.displayName;
      return n.length > 8 ? `${n.slice(0, 7)}…` : n;
    },
    userIdLabel() {
      return this.user?.userId || this.user?.id || '';
    },
    shortUserId() {
      const id = this.userIdLabel;
      return id.length > 9 ? `${id.slice(0, 8)}…` : id;
    },
    initials() {
      const n = this.displayName.trim();
      if (!n) return '?';
      const parts = n.split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return n.slice(0, 2).toUpperCase();
    },
  },
  methods: {
    logout() {
      store.logout();
      window.location.reload();
    },
  },
};
</script>
