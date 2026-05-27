<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950 p-4">
    <div class="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div class="flex border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          @click="mode = 'signin'"
          :class="tabClass('signin')"
        >
          Sign in
        </button>
        <button
          type="button"
          @click="mode = 'signup'"
          :class="tabClass('signup')"
        >
          Sign up
        </button>
      </div>

      <div class="p-6">
        <p v-if="error" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ error }}</p>

        <!-- Sign in -->
        <form v-if="mode === 'signin'" @submit.prevent="handleSignIn" class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">User ID or email</label>
            <input
              v-model="signInForm.userId"
              type="text"
              required
              class="w-full px-3 py-2 text-sm rounded-lg border dark:bg-gray-800 dark:border-gray-700"
              placeholder="e.g. jane_admin"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Password</label>
            <input
              v-model="signInForm.password"
              type="password"
              required
              class="w-full px-3 py-2 text-sm rounded-lg border dark:bg-gray-800 dark:border-gray-700"
              placeholder="••••••••"
            />
          </div>
          <p class="text-[11px] text-gray-500">Demo: <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">jane_admin</code> / <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">admin123</code></p>
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {{ loading ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <!-- Sign up: step 1 -->
        <form v-else-if="signupStep === 1" @submit.prevent="handleSignupStart" class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">User ID</label>
            <input v-model="signupForm.userId" type="text" required class="input-field" placeholder="unique_login_id" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
            <input v-model="signupForm.name" type="text" required class="input-field" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tenant code</label>
            <input v-model="signupForm.tenantCode" type="text" required class="input-field" placeholder="ACME or GLOBEX" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
            <input v-model="signupForm.email" type="email" required class="input-field" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mobile</label>
            <input v-model="signupForm.mobile" type="tel" required class="input-field" placeholder="+91..." />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Password</label>
            <input v-model="signupForm.password" type="password" required minlength="6" class="input-field" />
          </div>
          <button type="submit" :disabled="loading" class="btn-primary">
            {{ loading ? 'Please wait…' : 'Continue to verification' }}
          </button>
        </form>

        <!-- Sign up: verify email -->
        <div v-else-if="signupStep === 2" class="space-y-4">
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Verify email</h3>
          <p class="text-xs text-gray-500">Code sent to {{ signupForm.email }}</p>
          <p v-if="demoEmailCode" class="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 p-2 rounded">
            Demo code: <strong>{{ demoEmailCode }}</strong>
          </p>
          <input v-model="emailCode" type="text" maxlength="6" class="input-field" placeholder="6-digit code" />
          <div class="flex gap-2">
            <button type="button" @click="verifyEmail" :disabled="loading" class="btn-primary flex-1">Verify email</button>
            <button type="button" @click="resend('email')" class="text-xs text-indigo-600 px-2">Resend</button>
          </div>
        </div>

        <!-- Sign up: verify mobile -->
        <div v-else-if="signupStep === 3" class="space-y-4">
          <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Verify mobile</h3>
          <p class="text-xs text-gray-500">Code sent to {{ signupForm.mobile }}</p>
          <p v-if="demoMobileCode" class="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 p-2 rounded">
            Demo code: <strong>{{ demoMobileCode }}</strong>
          </p>
          <input v-model="mobileCode" type="text" maxlength="6" class="input-field" placeholder="6-digit code" />
          <div class="flex gap-2">
            <button type="button" @click="verifyMobile" :disabled="loading" class="btn-primary flex-1">Verify mobile</button>
            <button type="button" @click="resend('mobile')" class="text-xs text-indigo-600 px-2">Resend</button>
          </div>
        </div>

        <!-- Sign up: complete -->
        <div v-else-if="signupStep === 4" class="space-y-4 text-center">
          <p class="text-sm text-green-600 dark:text-green-400">Email and mobile verified.</p>
          <button type="button" @click="completeSignup" :disabled="loading" class="btn-primary w-full">
            {{ loading ? 'Creating account…' : 'Create account' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { store } from '../store.js';
import {
  authSignIn,
  authSignupStart,
  authSignupVerify,
  authSignupResend,
  authSignupComplete,
  fetchMe,
} from '../services/api.js';

export default {
  name: 'AuthScreen',
  emits: ['authenticated'],
  data() {
    return {
      mode: 'signin',
      signupStep: 1,
      loading: false,
      error: '',
      signInForm: { userId: '', password: '' },
      signupForm: {
        userId: '',
        name: '',
        tenantCode: 'ACME',
        email: '',
        mobile: '',
        password: '',
      },
      sessionId: null,
      emailCode: '',
      mobileCode: '',
      demoEmailCode: null,
      demoMobileCode: null,
      emailVerified: false,
      mobileVerified: false,
    };
  },
  methods: {
    tabClass(m) {
      return [
        'flex-1 py-3 text-sm font-medium transition-colors',
        this.mode === m
          ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
      ];
    },
    async handleSignIn() {
      this.loading = true;
      this.error = '';
      try {
        const { user } = await authSignIn(this.signInForm);
        store.login(user);
        const me = await fetchMe(user.id);
        store.setMe(me);
        this.$emit('authenticated');
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },
    async handleSignupStart() {
      this.loading = true;
      this.error = '';
      try {
        const data = await authSignupStart(this.signupForm);
        this.sessionId = data.sessionId;
        this.demoEmailCode = data.demoCodes?.email || null;
        this.demoMobileCode = data.demoCodes?.mobile || null;
        this.signupStep = 2;
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },
    async verifyEmail() {
      await this.runVerify('email', this.emailCode, 3);
    },
    async verifyMobile() {
      await this.runVerify('mobile', this.mobileCode, 4);
    },
    async runVerify(type, code, nextStep) {
      this.loading = true;
      this.error = '';
      try {
        const data = await authSignupVerify({
          sessionId: this.sessionId,
          type,
          code: code.trim(),
        });
        if (type === 'email') {
          this.emailVerified = data.emailVerified;
          this.signupStep = data.mobileVerified ? 4 : 3;
        } else {
          this.mobileVerified = data.mobileVerified;
          this.signupStep = data.ready ? 4 : 3;
        }
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },
    async resend(type) {
      try {
        const data = await authSignupResend({ sessionId: this.sessionId, type });
        if (type === 'email') this.demoEmailCode = data.demoCode;
        else this.demoMobileCode = data.demoCode;
      } catch (e) {
        this.error = e.message;
      }
    },
    async completeSignup() {
      this.loading = true;
      this.error = '';
      try {
        const { user } = await authSignupComplete({ sessionId: this.sessionId });
        store.login(user);
        const me = await fetchMe(user.id);
        store.setMe(me);
        this.$emit('authenticated');
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.input-field {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  border-radius: 0.5rem;
  border: 1px solid rgb(209 213 219);
}
.dark .input-field {
  background: rgb(31 41 55);
  border-color: rgb(55 65 81);
}
.btn-primary {
  width: 100%;
  padding: 0.625rem 0;
  background: rgb(79 70 229);
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.5rem;
}
.btn-primary:hover {
  background: rgb(67 56 202);
}
.btn-primary:disabled {
  opacity: 0.5;
}
</style>
