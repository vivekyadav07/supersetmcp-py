<template>
  <div class="flex h-full">
    <ChatSidebar />
    <div
      :class="[
        'flex flex-col flex-1 min-w-0 bg-gray-50 dark:bg-gray-900',
        store.isPortalTab() ? '' : 'border-r border-gray-200 dark:border-gray-800',
      ]"
    >
      <div class="p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 space-y-2">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {{ tabTitle }}
          </h2>
          <button
            @click="store.clearChat"
            class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 px-2 py-1 rounded bg-gray-200 dark:bg-gray-800"
          >
            Clear
          </button>
        </div>
        <div class="flex flex-wrap gap-2 items-center text-xs">
          <TenantSelect />
          <AskedAsSelect />
          <span v-if="store.isPortalTab()" class="text-gray-400">
            {{ store.currentUser.name }} ({{ store.currentUser.role }})
          </span>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4" ref="messagesContainer">
        <div v-if="store.messages.length === 0" class="text-center text-gray-500 dark:text-gray-400 mt-10 text-sm">
          <p>{{ emptyHint }}</p>
        </div>
        <ChatMessage
          v-for="(msg, index) in store.messages"
          :key="index"
          :msg="msg"
          @confirm="onConfirm"
          @cancel="onCancelConfirm"
        />
        <div v-if="isLoading" class="flex justify-start">
          <div class="bg-white dark:bg-gray-800 border rounded-lg p-3 flex gap-1 h-10 items-center">
            <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
            <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s" />
            <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s" />
          </div>
        </div>
      </div>

      <div class="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shrink-0">
        <form @submit.prevent="handleSubmit" class="relative">
          <input
            v-model="inputText"
            type="text"
            :placeholder="inputPlaceholder"
            class="w-full pl-4 pr-12 py-3 text-sm rounded-xl border bg-gray-50 dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500"
            :disabled="isLoading"
          />
          <button
            type="submit"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
            :disabled="!inputText.trim() || isLoading"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { store } from '../store.js';
import { askAI, chatPortal, confirmPortalAction, fetchMe } from '../services/api.js';
import ChatSidebar from './ChatSidebar.vue';
import ChatMessage from './ChatMessage.vue';
import TenantSelect from './TenantSelect.vue';
import AskedAsSelect from './AskedAsSelect.vue';

const TAB_TITLES = {
  dashboards: 'Dashboards',
  users: 'Users',
  sla_targets: 'SLA Targets',
  sla_performance: 'SLA Performance',
  tenants: 'Tenants',
};

const HINTS = {
  dashboards: 'Try: "top 5 sales" or "monthly revenue bar chart"',
  users: 'Try: "list users" or "invite ops@new.com"',
  sla_targets: 'Try: "list SLA targets" or "list categories"',
  sla_performance: 'Try: "pending performances" or "confirm perf sp2"',
  tenants: 'Try: "list tenants" or "create tenant ACME"',
};

export default {
  name: 'ChatPanel',
  components: { ChatSidebar, ChatMessage, TenantSelect, AskedAsSelect },
  data() {
    return {
      inputText: '',
      isLoading: false,
    };
  },
  computed: {
    store() {
      return store;
    },
    tabTitle() {
      return TAB_TITLES[store.activeTab] || 'Assistant';
    },
    emptyHint() {
      return HINTS[store.activeTab] || 'Ask a question';
    },
    inputPlaceholder() {
      return store.isPortalTab()
        ? 'Ask about users, tenants, SLA...'
        : 'Ask a question about your data...';
    },
  },
  watch: {
    'store.messages.length'() {
      this.scrollToBottom();
    },
    'store.activeTab'() {
      this.scrollToBottom();
    },
  },
  async mounted() {
    const uid = store.sessionUserId || store.currentUser?.id;
    if (!uid) return;
    try {
      const me = await fetchMe(uid);
      store.setMe(me);
      if (me.tenants?.length && !store.selectedTenantId) {
        store.selectedTenantId = me.tenants[0].id;
      }
    } catch (e) {
      console.warn('Could not load /api/me:', e.message);
    }
  },
  methods: {
    async scrollToBottom() {
      await this.$nextTick();
      const el = this.$refs.messagesContainer;
      if (el) el.scrollTop = el.scrollHeight;
    },
    async handleSubmit() {
      const text = this.inputText.trim();
      if (!text || this.isLoading) return;

      store.addMessage({
        role: 'user',
        content: text,
        askedAs: store.askedAs,
      });
      this.inputText = '';
      this.isLoading = true;
      this.scrollToBottom();

      try {
        if (store.activeTab === 'dashboards') {
          const response = await askAI(text);
          store.addChart({
            id: Date.now().toString(),
            ...response,
            title: text,
          });
          store.setCurrentSql(response.sql);
          store.addMessage({
            role: 'ai',
            content: `I've created a ${response.chartType} chart for you.`,
            chartGenerated: true,
          });
        } else {
          const response = await chatPortal({
            query: text,
            activeTab: store.activeTab,
            tenantId: store.selectedTenantId,
            userId: store.sessionUserId || store.currentUser?.id,
            askedAs: store.askedAs,
          });
          store.addMessage({
            role: 'ai',
            content: response.content,
            payload: response.payload,
            confirmationToken: response.confirmationToken,
          });
        }
      } catch (error) {
        store.addMessage({
          role: 'ai',
          content: `Sorry, something went wrong: ${error.message}`,
        });
      } finally {
        this.isLoading = false;
        this.scrollToBottom();
      }
    },
    async onConfirm(action) {
      if (!action?.token) return;
      this.isLoading = true;
      try {
        const response = await confirmPortalAction({
          token: action.token,
          userId: store.sessionUserId || store.currentUser?.id,
        });
        store.addMessage({
          role: 'ai',
          content: response.content,
          payload: response.payload,
        });
      } catch (error) {
        store.addMessage({
          role: 'ai',
          content: `Confirmation failed: ${error.message}`,
        });
      } finally {
        this.isLoading = false;
        this.scrollToBottom();
      }
    },
    onCancelConfirm() {
      store.addMessage({
        role: 'ai',
        content: 'Delete cancelled.',
      });
    },
  },
};
</script>
