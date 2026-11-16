import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, setCsrf } from './api';
interface Session {
  user: { name: string; email: string };
  csrfToken: string;
  workspaces: { id: string; name: string; role: string }[];
}
export const useSession = defineStore('session', () => {
  const data = ref<Session | null>(null);
  const tenant = ref(localStorage.getItem('workspace') ?? '');
  const ready = ref(false);
  const workspace = computed(() =>
    data.value?.workspaces.find((w) => w.id === tenant.value),
  );
  async function load() {
    try {
      data.value = await api<Session>('/api/session');
      setCsrf(data.value.csrfToken);
      if (!data.value.workspaces.some((w) => w.id === tenant.value))
        select(data.value.workspaces[0]?.id ?? '');
    } catch {
      data.value = null;
      setCsrf('');
    } finally {
      ready.value = true;
    }
  }
  function select(id: string) {
    tenant.value = id;
    localStorage.setItem('workspace', id);
  }
  async function login(email: string, password: string) {
    await api('/api/login', 'POST', { email, password });
    await load();
    if (!data.value) throw new Error('Không tải được phiên đăng nhập.');
  }
  async function logout() {
    await api('/api/logout', 'POST');
    data.value = null;
    setCsrf('');
  }
  return { data, tenant, ready, workspace, load, select, login, logout };
});
