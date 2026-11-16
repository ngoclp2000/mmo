<script setup lang="ts">
import { computed, onMounted, ref, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { useSession } from './session';
import { api } from './api';
import type { Dashboard, Fixture, Observation, Watch } from './types';
import Icon from './components/AppIcon.vue';
import ProductArt from './components/ProductArt.vue';
import PriceChart from './components/PriceChart.vue';

const session = useSession();
const route = useRoute();
const router = useRouter();
const client = useQueryClient();
const email = ref('demo-a@commerceos.local');
const password = ref('');
const busy = ref(false);
const loginError = ref('');
const search = ref('');
const notice = ref('');
const error = ref('');
const adding = ref(false);
const dialog = ref<HTMLDialogElement | null>(null);
const detailDialog = ref<HTMLDialogElement | null>(null);
const productUrl = ref('');
const resolved = ref<Fixture | null>(null);
const skuId = ref('');
const target = ref(1000000);
const consent = ref(false);
const selected = ref<Watch | null>(null);
const scenario = ref('drop');
const nav = [
  { path: '/overview', label: 'Tổng quan', icon: 'grid' },
  { path: '/watchlist', label: 'Theo dõi giá', icon: 'eye' },
  { path: '/library', label: 'Thư viện mẫu', icon: 'box' },
  { path: '/alerts', label: 'Cảnh báo', icon: 'bell' },
  { path: '/operations', label: 'Vận hành', icon: 'pulse' },
];
const currentPage = computed(() => nav.find((n) => n.path === route.path));
const prefix = computed(() => `/api/workspaces/${session.tenant}`);
const enabled = computed(() => Boolean(session.data && session.tenant));
const {
  data: dash,
  isPending,
  error: loadError,
} = useQuery({
  queryKey: computed(() => ['dashboard', session.tenant]),
  enabled,
  queryFn: () => api<Dashboard>(`${prefix.value}/dashboard`),
  refetchInterval: 1500,
});
const { data: library } = useQuery({
  queryKey: computed(() => ['fixtures', session.tenant]),
  enabled,
  queryFn: () => api<{ fixtures: Fixture[] }>(`${prefix.value}/fixtures`),
});
const { data: auditLog } = useQuery({
  queryKey: computed(() => ['audit', session.tenant]),
  enabled: computed(
    () =>
      enabled.value &&
      route.path === '/operations' &&
      session.workspace?.role === 'admin',
  ),
  queryFn: () =>
    api<{
      entries: { action: string; resource_id: string; created_at: string }[];
    }>(`${prefix.value}/audit`),
  refetchInterval: 3000,
});
const { data: history } = useQuery({
  queryKey: computed(() => [
    'history',
    session.tenant,
    selected.value?.id,
    dash.value?.jobs.filter((j) => j.status === 'completed').length,
  ]),
  enabled: computed(() => enabled.value && !!selected.value),
  queryFn: () =>
    api<{ history: Observation[] }>(
      `${prefix.value}/watches/${selected.value!.id}/history`,
    ),
});
const watches = computed(() => dash.value?.watches ?? []);
const filtered = computed(() =>
  watches.value.filter((w) =>
    `${w.fixture.listing.title} ${w.fixture.variant}`
      .toLowerCase()
      .includes(search.value.toLowerCase()),
  ),
);
const alerts = computed(() => dash.value?.alerts ?? []);
const activeCount = computed(
  () => watches.value.filter((w) => w.active).length,
);
const priceDrops = computed(
  () =>
    watches.value.filter(
      (w) => Number(w.change_pct) > 0 && w.score_status === 'available',
    ).length,
);
const selectedFresh = computed(
  () =>
    watches.value.find((w) => w.id === selected.value?.id) ?? selected.value,
);
const money = (n: number | string) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(n));
const date = (s: string) =>
  new Date(s).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
const jobLabel: Record<string, string> = {
  pending: 'Đang chờ',
  processing: 'Đang xử lý',
  completed: 'Hoàn tất',
  dead: 'Dead-letter',
  cancelled: 'Đã dừng',
};
const scenarioLabel: Record<string, string> = {
  steady: 'Giữ nguyên giá',
  drop: 'Giá giảm 25%',
  stale: 'Dữ liệu cũ',
  currency: 'Khác tiền tệ',
  'rate-limit': '429 → retry',
  failure: 'Lỗi nhà cung cấp',
};
const alertTitle = (id: string) =>
  watches.value.find((w) => w.id === id)?.fixture.listing.title ??
  'Sản phẩm mẫu';
async function refresh() {
  await client.invalidateQueries({ queryKey: ['dashboard', session.tenant] });
  await client.invalidateQueries({ queryKey: ['history', session.tenant] });
}
async function run(action: () => Promise<unknown>, success?: string) {
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await action();
    if (success) notice.value = success;
    await refresh();
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : 'Không thể hoàn tất yêu cầu.';
  } finally {
    busy.value = false;
  }
}
async function signIn() {
  busy.value = true;
  loginError.value = '';
  try {
    await session.login(email.value, password.value);
    password.value = '';
  } catch (e) {
    loginError.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function logout() {
  await run(async () => {
    await session.logout();
    client.clear();
  });
}
async function openAdd(fixture?: Fixture) {
  adding.value = true;
  resolved.value = null;
  skuId.value = '';
  consent.value = false;
  error.value = '';
  productUrl.value = fixture ? `https://${fixture.source}${fixture.path}` : '';
  await nextTick();
  dialog.value?.showModal();
  if (fixture) await resolveProduct();
}
function closeAdd() {
  dialog.value?.close();
  adding.value = false;
}
async function resolveProduct() {
  await run(async () => {
    const result = await api<{ fixture: Fixture }>(
      `${prefix.value}/resolve`,
      'POST',
      { url: productUrl.value },
    );
    resolved.value = result.fixture;
    skuId.value = result.fixture.skus[0].id;
    target.value = Math.round(result.fixture.skus[0].price * 0.85);
  });
}
async function addWatch() {
  await run(async () => {
    await api(`${prefix.value}/watches`, 'POST', {
      skuId: skuId.value,
      targetPrice: target.value,
      consent: consent.value,
    });
    closeAdd();
    await router.push('/watchlist');
  }, 'Đã bật theo dõi mẫu. Worker sẽ lấy quan sát tiếp theo.');
}
async function inspect(w: Watch) {
  selected.value = w;
  scenario.value = 'drop';
  error.value = '';
  await nextTick();
  detailDialog.value?.showModal();
}
function closeDetail() {
  detailDialog.value?.close();
  selected.value = null;
}
async function simulate() {
  if (!selected.value) return;
  await run(
    () =>
      api(`${prefix.value}/watches/${selected.value!.id}/check`, 'POST', {
        scenario: scenario.value,
        requestKey: crypto.randomUUID(),
      }),
    'Đã xếp lịch kiểm tra. Worker đang xử lý.',
  );
}
async function toggle(w: Watch, field: 'active' | 'consent') {
  await run(
    () =>
      api(`${prefix.value}/watches/${w.id}`, 'PATCH', {
        targetPrice: Number(w.target_price),
        active: field === 'active' ? !w.active : Boolean(w.active),
        consent: field === 'consent' ? !w.consent : Boolean(w.consent),
      }),
    field === 'consent'
      ? 'Đã cập nhật quyền nhận cảnh báo.'
      : 'Đã cập nhật trạng thái theo dõi.',
  );
}
async function outbound(w: Watch) {
  await run(async () => {
    await api(`${prefix.value}/watches/${w.id}/click`, 'POST', {
      requestKey: crypto.randomUUID(),
    });
    closeDetail();
    await router.push('/demo-destination');
  });
}
async function replay(id: string) {
  await run(
    () => api(`${prefix.value}/jobs/${id}/replay`, 'POST', {}),
    'Đã đưa job vào hàng đợi lại; giữ nguyên định danh để chống trùng.',
  );
}
watch(
  () => session.tenant,
  () => {
    selected.value = null;
    closeAdd();
    detailDialog.value?.close();
    search.value = '';
  },
);
watch(productUrl, () => {
  resolved.value = null;
});
onMounted(() => session.load());
</script>

<template>
  <div v-if="!session.ready" class="loading-screen">
    <span class="brand-mark"><Icon name="grid" /></span> Đang mở workspace…
  </div>
  <main v-else-if="!session.data" class="login-screen">
    <section class="login-story">
      <a class="brand" href="/overview"
        ><span class="brand-mark"><Icon name="grid" /></span>commerce<span
          class="brand-os"
          >os</span
        ></a
      ><span class="eyebrow">YOUR COMMERCE, CONNECTED</span>
      <h1>Một góc nhìn rõ hơn.<br />Mỗi quyết định<br /><em>tốt hơn.</em></h1>
      <p>
        Từ giá quan sát đến hành động có cơ sở.<br />Không gian làm việc cho
        hành trình commerce của bạn.
      </p>
      <div class="login-preview">
        <ProductArt kind="sneaker" />
        <div>
          <span class="tag">SYNTHETIC DEMO</span>
          <h3>Everyday Runner</h3>
          <p>Đúng SKU. Rõ nguồn. Có thời điểm.</p>
        </div>
      </div>
      <small>Commerce Intelligence · Built with clarity</small>
    </section>
    <section class="login-form-wrap">
      <form class="login-form" @submit.prevent="signIn">
        <span class="pill"><span class="status-dot" /> LOCAL DEMO</span>
        <h2>Chào mừng trở lại</h2>
        <p>Đăng nhập để mở workspace CommerceOS.</p>
        <label for="email">Email</label
        ><input
          id="email"
          v-model="email"
          type="email"
          autocomplete="username"
          required
        /><label for="password">Mật khẩu</label
        ><input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          placeholder="Mật khẩu demo trong .env"
        />
        <p v-if="loginError" class="error-message" role="alert">
          {{ loginError }}
        </p>
        <button class="button primary" :disabled="busy">
          {{ busy ? 'Đang đăng nhập…' : 'Mở workspace' }}<Icon name="arrow" />
        </button>
        <div class="demo-note">
          <Icon name="info" />
          <div>
            <strong>Dữ liệu tổng hợp, trải nghiệm thật.</strong>
            <p>
              Bản demo không kết nối sàn hoặc giao dịch thật. Dùng mật khẩu
              <code>DEMO_PASSWORD</code> đã đặt khi seed.
            </p>
          </div>
        </div>
      </form>
      <small>Phiên đăng nhập được bảo vệ bằng cookie HttpOnly.</small>
    </section>
  </main>
  <div v-else class="app-shell">
    <aside class="sidebar">
      <RouterLink to="/overview" class="brand"
        ><span class="brand-mark"><Icon name="grid" /></span>commerce<span
          class="brand-os"
          >os</span
        ></RouterLink
      >
      <div class="workspace-picker">
        <span class="workspace-avatar">{{ session.workspace?.name[0] }}</span>
        <div>
          <label for="workspace">WORKSPACE</label
          ><select
            id="workspace"
            :value="session.tenant"
            @change="session.select(($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="w in session.data.workspaces"
              :key="w.id"
              :value="w.id"
            >
              {{ w.name }}
            </option>
          </select>
        </div>
      </div>
      <p class="nav-label">KHÔNG GIAN LÀM VIỆC</p>
      <nav aria-label="Điều hướng chính">
        <RouterLink
          v-for="item in nav"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          ><Icon :name="item.icon" /><span>{{ item.label }}</span
          ><span
            v-if="item.path === '/alerts' && alerts.length"
            class="nav-count"
            >{{ alerts.length }}</span
          ></RouterLink
        >
      </nav>
      <div class="sidebar-bottom">
        <div class="connection-note">
          <span class="status-dot" /><strong>Mock workspace</strong>
          <p>Dữ liệu mẫu. Không kết nối sàn thật.</p>
          <RouterLink to="/operations"
            >Xem trạng thái nguồn <Icon name="arrow" :size="14"
          /></RouterLink>
        </div>
        <div class="user-card">
          <span class="avatar">{{ session.data.user.name.slice(0, 1) }}</span>
          <div>
            <strong>{{ session.data.user.name }}</strong><small>{{
              session.workspace?.role === 'admin'
                ? 'Workspace admin'
                : 'Thành viên'
            }}</small>
          </div>
          <button class="icon-button" aria-label="Đăng xuất" @click="logout">
            <Icon name="logout" :size="18" />
          </button>
        </div>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="breadcrumb">
          Workspace <span>/</span
          ><strong>{{ currentPage?.label ?? 'Link demo' }}</strong>
        </div>
        <div class="topbar-tools">
          <span class="demo-badge"
            ><span class="status-dot" /> Synthetic demo</span
          ><RouterLink to="/alerts" class="icon-button" aria-label="Mở cảnh báo"
            ><Icon name="bell" /><span
              v-if="alerts.length"
              class="notification-dot" /></RouterLink
          ><span class="avatar small">{{ session.data.user.name[0] }}</span>
        </div>
      </header>
      <div class="mobile-nav">
        <RouterLink v-for="item in nav" :key="item.path" :to="item.path"
          ><Icon :name="item.icon" :size="16" />{{ item.label }}</RouterLink
        ><button class="icon-button" @click="logout" aria-label="Đăng xuất">
          <Icon name="logout" />
        </button>
      </div>
      <div v-if="notice" class="toast success" role="status">
        <Icon name="check" />{{ notice
        }}<button
          class="icon-button"
          aria-label="Đóng thông báo"
          @click="notice = ''"
        >
          <Icon name="close" :size="16" />
        </button>
      </div>
      <div
        v-if="error && !adding && !selected"
        class="toast error-message"
        role="alert"
      >
        {{ error
        }}<button class="icon-button" @click="error = ''" aria-label="Đóng lỗi">
          <Icon name="close" />
        </button>
      </div>
      <main class="content">
        <div class="page-heading">
          <div>
            <p class="eyebrow">
              {{
                route.path === '/overview'
                  ? 'COMMERCE INTELLIGENCE'
                  : 'YOUR COMMERCE WORKSPACE'
              }}
            </p>
            <h1>
              {{
                route.path === '/overview'
                  ? 'Tổng quan workspace'
                  : (currentPage?.label ?? 'Điểm đến affiliate demo')
              }}<span v-if="route.path === '/overview'" class="heading-dot"
                >.</span
              >
            </h1>
            <p>
              {{
                route.path === '/overview'
                  ? 'Một nơi để theo dõi biến động, tìm cơ hội và hành động.'
                  : route.path === '/watchlist'
                    ? 'Theo dõi đúng SKU, với những con số có nguồn gốc.'
                    : route.path === '/library'
                      ? 'Bắt đầu từ một sản phẩm tổng hợp. Không cần truy cập sàn.'
                      : route.path === '/alerts'
                        ? 'Chỉ cảnh báo khi dữ liệu đủ mới và bạn đã đồng ý nhận.'
                        : route.path === '/operations'
                          ? 'Hàng đợi, quyền dữ liệu và dấu vết hoạt động.'
                          : 'Click đã được ghi nhận riêng với conversion và commission.'
              }}
            </p>
          </div>
          <button
            v-if="['/overview', '/watchlist', '/library'].includes(route.path)"
            class="button primary"
            @click="openAdd()"
          >
            <Icon name="plus" :size="18" />Theo dõi sản phẩm
          </button>
        </div>
        <div v-if="loadError" class="error-panel" role="alert">
          <Icon name="info" />Không tải được workspace. {{ loadError.message
          }}<button class="button secondary" @click="refresh">Thử lại</button>
        </div>
        <div
          v-if="isPending"
          class="skeleton-row"
          aria-label="Đang tải dữ liệu"
        >
          <div v-for="n in 4" :key="n" />
        </div>
        <template v-else>
          <template v-if="route.path === '/overview'">
            <section class="hero">
              <div class="hero-copy">
                <span class="hero-eyebrow"
                  ><span /> TỪ QUAN SÁT ĐẾN CƠ HỘI</span
                >
                <h2>Đón biến động giá.<br /><em>Nắm thế chủ động.</em></h2>
                <p>
                  Theo dõi sản phẩm bạn quan tâm, nhận cảnh báo<br
                    class="desktop-only"
                  />
                  đúng lúc và hiểu vì sao một cơ hội đáng chú ý.
                </p>
                <button class="button cream" @click="openAdd()">
                  Bắt đầu theo dõi <Icon name="arrow" :size="18" /></button
                ><span class="hero-footnote"
                  ><Icon name="shield" :size="13" /> Giá có nguồn gốc · Cảnh báo
                  có sự đồng ý</span
                >
              </div>
              <div class="hero-visual" aria-hidden="true">
                <div class="orb orb-one" />
                <div class="orb orb-two" />
                <div class="floating-price">
                  <span class="floating-icon"
                    ><Icon name="chart" :size="20"
                  /></span>
                  <div>
                    <small>BIẾN ĐỘNG GIÁ MẪU</small
                    ><strong>1.290.000 <span>₫</span></strong>
                  </div>
                  <span class="mini-trend"><Icon name="down" :size="18" /></span
                  ><svg viewBox="0 0 220 62">
                    <path
                      d="M0 10L27 17 44 10 66 29 89 20 107 32 127 28 148 44 168 37 192 51 220 47"
                      fill="none"
                      stroke="#84a883"
                      stroke-width="3"
                    />
                  </svg>
                  <div class="floating-bottom">
                    <span class="status-dot" /> Đúng SKU · Synthetic fixture
                  </div>
                </div>
                <div class="floating-alert">
                  <span><Icon name="bell" :size="18" /></span>
                  <div>
                    <strong>Cơ hội nằm trong tầm mắt</strong
                    ><small>Opt-in. Đủ mới. Có giải thích.</small>
                  </div>
                  <Icon name="check" :size="18" />
                </div>
              </div>
            </section>
            <section class="stat-grid" aria-label="Số liệu workspace">
              <article class="stat-card">
                <div><span>Đang theo dõi</span><Icon name="eye" /></div>
                <strong>{{ activeCount }}<small> SKU</small></strong>
                <p><span class="tiny-dot" /> Theo dõi theo biến thể cụ thể</p>
              </article>
              <article class="stat-card">
                <div><span>Giá đang giảm</span><Icon name="chart" /></div>
                <strong>{{ priceDrops }}<small> sản phẩm</small></strong>
                <p>So với baseline quan sát mẫu</p>
              </article>
              <article class="stat-card">
                <div><span>Cảnh báo đã gửi</span><Icon name="bell" /></div>
                <strong>{{ alerts.length }}<small> cảnh báo</small></strong>
                <p>Inbox demo · Chống gửi trùng</p>
              </article>
              <article class="stat-card">
                <div>
                  <span>Affiliate outbound</span><Icon name="external" />
                </div>
                <strong data-testid="click-count"
                  >{{ dash?.clicks ?? 0 }}<small> click</small></strong
                >
                <p>Click demo, chưa có commission</p>
              </article>
            </section>
          </template>
          <section
            v-if="['/overview', '/watchlist'].includes(route.path)"
            class="watch-section"
          >
            <div class="section-heading">
              <div>
                <h2>
                  Sản phẩm đang theo dõi
                  <span class="count-pill">{{ watches.length }}</span>
                </h2>
                <p>Giá quan sát, không phải giá thanh toán cuối cùng.</p>
              </div>
              <RouterLink
                v-if="route.path === '/overview'"
                class="text-link"
                to="/watchlist"
                >Xem tất cả <Icon name="arrow" :size="16" /></RouterLink
              ><label v-else class="search-field"
                ><Icon name="search" :size="17" /><input
                  v-model="search"
                  placeholder="Tìm sản phẩm…"
                  aria-label="Tìm sản phẩm đang theo dõi"
              /></label>
            </div>
            <div v-if="!watches.length" class="empty-state">
              <div class="empty-graphic"><Icon name="eye" :size="30" /></div>
              <h3>Cơ hội bắt đầu từ một sản phẩm</h3>
              <p>
                Thêm sản phẩm mẫu để xem luồng theo dõi giá hoạt động.<br />Worker
                sẽ xử lý quan sát, score và cảnh báo trong workspace này.
              </p>
              <button
                class="button secondary"
                @click="openAdd(library?.fixtures[0])"
              >
                <Icon name="plus" :size="17" />Thử với Everyday Runner
              </button>
            </div>
            <div v-else-if="!filtered.length" class="empty-state">
              <h3>Không có sản phẩm phù hợp</h3>
              <button class="text-link" @click="search = ''">Xóa bộ lọc</button>
            </div>
            <div v-else class="product-grid">
              <article
                v-for="w in route.path === '/overview'
                  ? filtered.slice(0, 3)
                  : filtered"
                :key="w.id"
                class="product-card"
                data-testid="watch-card"
              >
                <button
                  class="product-image"
                  :style="{ background: w.fixture.listing.color }"
                  :aria-label="`Xem ${w.fixture.listing.title}`"
                  @click="inspect(w)"
                >
                  <span class="tag">SYNTHETIC</span
                  ><ProductArt :kind="w.fixture.listing.id" /><span
                    v-if="!w.active"
                    class="image-state"
                    >Tạm dừng</span
                  ><span
                    v-else-if="
                      w.score_status === 'available' && Number(w.change_pct) > 0
                    "
                    class="drop-tag"
                    ><Icon name="down" :size="12" />{{ w.change_pct }}%</span
                  >
                </button>
                <div class="product-info">
                  <div class="product-meta">
                    <span>{{
                      w.fixture.listing.source === 'shopee.vn'
                        ? 'SHOPEE · MOCK'
                        : 'TIKTOK · MOCK'
                    }}</span><span :class="['freshness', w.freshness]"
                      ><span />{{
                        w.freshness === 'fresh' ? 'Đủ mới' : 'Cũ'
                      }}</span
                    >
                  </div>
                  <button class="product-title" @click="inspect(w)">
                    {{ w.fixture.listing.title }}
                  </button>
                  <p class="variant">{{ w.fixture.variant }}</p>
                  <div class="price-row">
                    <strong>{{ money(w.current_price) }}</strong><span
                      v-if="w.score_status === 'available'"
                      class="score-pill"
                      >{{ w.score }}/100</span
                    ><span v-else class="muted">{{
                      w.score_status === 'stale' ? 'Dữ liệu cũ' : 'Chưa đủ mẫu'
                    }}</span>
                  </div>
                  <div class="target-row">
                    <span
                      ><Icon name="bell" :size="13" /> Ngưỡng
                      {{ money(w.target_price) }}</span
                    ><span>{{ w.consent ? 'Opt-in' : 'Đã tắt' }}</span>
                  </div>
                  <div class="card-bottom">
                    <span>{{ date(w.observed_at) }} · UTC+7</span
                    ><button class="text-link" @click="inspect(w)">
                      Chi tiết <Icon name="arrow" :size="14" />
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </section>
          <section
            v-if="['/overview', '/library'].includes(route.path)"
            class="library-section"
          >
            <div class="section-heading">
              <div>
                <h2>
                  {{
                    route.path === '/overview'
                      ? 'Khám phá luồng mẫu'
                      : 'Thư viện synthetic'
                  }}
                  <span class="subtle-label">CURATED FOR YOUR DEMO</span>
                </h2>
                <p>3 sản phẩm tổng hợp. Mọi mức giá đều được gắn nhãn mẫu.</p>
              </div>
              <span class="pill light"
                ><Icon name="box" :size="14" /> Fixture-driven</span
              >
            </div>
            <div class="library-grid">
              <article
                v-for="f in library?.fixtures"
                :key="f.id"
                class="library-card"
              >
                <div class="library-art" :style="{ background: f.color }">
                  <ProductArt :kind="f.id" />
                </div>
                <div class="library-info">
                  <span class="category">{{ f.category }}</span>
                  <h3>{{ f.title }}</h3>
                  <span
                    >{{ f.skus.length }} biến thể · Từ
                    {{ money(f.skus[0].price) }}</span
                  ><button class="text-link" @click="openAdd(f)">
                    Theo dõi mẫu <Icon name="plus" :size="15" />
                  </button>
                </div>
              </article>
            </div>
            <div class="source-note">
              <Icon name="info" :size="17" />
              <p>
                <strong>Minh bạch từ nguồn dữ liệu.</strong> Shopee và TikTok
                API hiện ở trạng thái <em>chưa xác minh quyền</em>. Không có dữ
                liệu marketplace thật trong bản demo.
              </p>
            </div>
          </section>
          <section v-if="route.path === '/alerts'" class="panel">
            <div class="section-heading">
              <div>
                <h2>
                  Inbox workspace
                  <span class="count-pill">{{ alerts.length }}</span>
                </h2>
                <p>Chỉ hiển thị cảnh báo đã giao. Thời gian UTC+7.</p>
              </div>
            </div>
            <div v-if="!alerts.length" class="empty-state">
              <div class="empty-graphic"><Icon name="bell" :size="30" /></div>
              <h3>Chưa có cảnh báo</h3>
              <p>
                Bật opt-in, lấy đủ 2 mẫu rồi mô phỏng giá giảm dưới ngưỡng.<br />Dữ
                liệu cũ hoặc khác tiền tệ sẽ không tạo cảnh báo.
              </p>
              <RouterLink class="button secondary" to="/watchlist"
                >Đến danh sách theo dõi <Icon name="arrow" :size="16"
              /></RouterLink>
            </div>
            <article
              v-for="a in alerts"
              :key="a.id"
              class="alert-row"
              data-testid="alert-row"
            >
              <span class="alert-icon"><Icon name="chart" /></span>
              <div>
                <h3>{{ alertTitle(a.watch_id) }} đạt ngưỡng giá</h3>
                <p>
                  Giá mẫu {{ money(a.amount) }} · Đã giao vào inbox · Synthetic
                </p>
              </div>
              <time>{{ date(a.created_at) }}</time>
            </article>
            <div class="source-note">
              <Icon name="shield" :size="17" />
              <p>
                Thu hồi opt-in trong chi tiết sản phẩm sẽ ngăn lần gửi tiếp
                theo. Không gửi email hoặc Telegram thật.
              </p>
            </div>
          </section>
          <template v-if="route.path === '/operations'"
            ><section class="panel">
              <div class="section-heading">
                <div>
                  <h2>Năng lực nguồn dữ liệu</h2>
                  <p>Chưa xác minh không có nghĩa là được phép sử dụng.</p>
                </div>
                <span class="pill light">Mock mode</span>
              </div>
              <div class="capability-grid">
                <article>
                  <Icon name="box" />
                  <h3>Local fixtures</h3>
                  <span class="badge available">AVAILABLE · SYNTHETIC</span>
                  <p>
                    Listing, SKU, giá quan sát, cảnh báo inbox và click demo.
                  </p>
                </article>
                <article>
                  <Icon name="shield" />
                  <h3>Shopee API</h3>
                  <span class="badge unverified">UNVERIFIED</span>
                  <p>
                    Chờ bằng chứng scopes, quota, điều khoản và quyền lưu dữ
                    liệu.
                  </p>
                </article>
                <article>
                  <Icon name="shield" />
                  <h3>TikTok Shop API</h3>
                  <span class="badge unverified">UNVERIFIED</span>
                  <p>
                    Không suy quyền affiliate từ quyền seller hoặc tài khoản
                    khác.
                  </p>
                </article>
              </div>
            </section>
            <section class="panel jobs-panel">
              <div class="section-heading">
                <div>
                  <h2>Hàng đợi & dead-letter</h2>
                  <p>
                    Lease, retry có backoff và idempotency lưu trong MySQL. 20
                    job gần nhất.
                  </p>
                </div>
                <button
                  class="icon-button"
                  aria-label="Làm mới hàng đợi"
                  @click="refresh"
                >
                  <Icon name="refresh" />
                </button>
              </div>
              <div v-if="!dash?.jobs.length" class="empty-state compact">
                <Icon name="pulse" :size="28" />
                <h3>Hàng đợi đang trống</h3>
                <p>Thêm SKU để tạo job đầu tiên.</p>
              </div>
              <div v-else class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Job / sản phẩm</th>
                      <th>Kịch bản</th>
                      <th>Trạng thái</th>
                      <th>Lần thử</th>
                      <th>Thời gian</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="job in dash.jobs" :key="job.id">
                      <td>
                        <strong>{{ alertTitle(job.watch_id) }}</strong><small
                          class="mono"
                          >{{ job.id.slice(0, 8) }}</small
                        >
                      </td>
                      <td>{{ scenarioLabel[job.scenario] }}</td>
                      <td>
                        <span
                          :class="[
                            'badge',
                            job.status === 'completed'
                              ? 'available'
                              : job.status === 'dead'
                                ? 'danger'
                                : 'unverified',
                          ]"
                          >{{ jobLabel[job.status] }}</span><small
                          v-if="job.last_error"
                          >{{ job.last_error }}</small
                        >
                      </td>
                      <td>{{ job.attempts }}/3</td>
                      <td>{{ date(job.created_at) }}</td>
                      <td>
                        <button
                          v-if="
                            job.status === 'dead' &&
                            session.workspace?.role === 'admin'
                          "
                          class="text-link"
                          :disabled="busy"
                          @click="replay(job.id)"
                        >
                          Replay <Icon name="refresh" :size="14" /></button
                        ><span v-else>—</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            <section v-if="session.workspace?.role === 'admin'" class="panel">
              <div class="section-heading">
                <div>
                  <h2>Audit workspace</h2>
                  <p>
                    100 hành động gần nhất. Không lưu token hoặc nội dung nhạy
                    cảm.
                  </p>
                </div>
                <Icon name="shield" />
              </div>
              <div v-if="auditLog?.entries.length" class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Hành động</th>
                      <th>Resource</th>
                      <th>Thời gian UTC+7</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(entry, i) in auditLog.entries" :key="i">
                      <td>{{ entry.action }}</td>
                      <td class="mono">{{ entry.resource_id?.slice(0, 8) }}</td>
                      <td>{{ date(entry.created_at) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="muted">Chưa có hoạt động.</p>
            </section></template
          >
          <section
            v-if="route.path === '/demo-destination'"
            class="destination panel"
          >
            <span class="empty-graphic"
              ><Icon name="external" :size="30" /></span
            ><span class="eyebrow">AFFILIATE DISCLOSURE · DEMO</span>
            <h2>Một click được ghi nhận.<br />Mọi giới hạn đều rõ ràng.</h2>
            <p>
              Bạn đang ở điểm đến mẫu trong CommerceOS. Không mở trang bán hàng,
              không tạo đơn và không phát sinh hoa hồng.
            </p>
            <div class="destination-stats">
              <div>
                <strong>{{ dash?.clicks ?? 0 }}</strong><span
                  >Click demo trong workspace</span
                >
              </div>
              <div>
                <strong>Unavailable</strong><span>Conversion & commission</span>
              </div>
            </div>
            <RouterLink class="button primary" to="/overview"
              >Về tổng quan <Icon name="arrow" :size="17"
            /></RouterLink>
          </section>
        </template>
        <footer class="page-footer">
          <span>commerceos <span>·</span> Commerce, with clarity.</span
          ><span
            ><span class="tiny-dot" /> Synthetic data only · Mock mode</span
          >
        </footer>
      </main>
    </div>
    <dialog
      ref="dialog"
      class="modal"
      @cancel="adding = false"
      @close="adding = false"
    >
      <div class="modal-heading">
        <div>
          <span class="eyebrow">THEO DÕI ĐÚNG BIẾN THỂ</span>
          <h2>Thêm sản phẩm</h2>
        </div>
        <button
          class="icon-button"
          aria-label="Đóng thêm sản phẩm"
          @click="closeAdd"
        >
          <Icon name="close" />
        </button>
      </div>
      <p class="modal-intro">
        Nhập URL mẫu để chọn SKU. Không truy cập website thật.
      </p>
      <form @submit.prevent="resolveProduct">
        <label for="product-url">URL sản phẩm mẫu</label>
        <div class="url-input">
          <Icon name="link" :size="18" /><input
            id="product-url"
            v-model="productUrl"
            type="url"
            required
            placeholder="https://shopee.vn/mock/sneaker"
          /><button class="button primary" :disabled="busy">
            {{ busy ? 'Đang xử lý…' : 'Kiểm tra' }}
          </button>
        </div>
      </form>
      <div v-if="!resolved" class="quick-fixtures">
        <span>Thử nhanh:</span
        ><button
          v-for="f in library?.fixtures"
          :key="f.id"
          @click="
            productUrl = `https://${f.source}${f.path}`;
            resolveProduct();
          "
        >
          {{ f.title }} <Icon name="arrow" :size="12" />
        </button>
      </div>
      <div v-if="error" class="error-message" role="alert">{{ error }}</div>
      <form v-if="resolved" class="resolved-form" @submit.prevent="addWatch">
        <div class="resolved-product">
          <div :style="{ background: resolved.color }">
            <ProductArt :kind="resolved.id" />
          </div>
          <div>
            <span class="tag">SYNTHETIC FIXTURE</span>
            <h3>{{ resolved.title }}</h3>
            <p>{{ resolved.source }} · Mock adapter</p>
          </div>
        </div>
        <label for="sku">Biến thể / SKU chính xác</label
        ><select id="sku" v-model="skuId">
          <option v-for="sku in resolved.skus" :key="sku.id" :value="sku.id">
            {{ sku.variant }} · {{ money(sku.price) }}
          </option></select
        ><label for="target">Cảnh báo khi giá ≤ (VND)</label
        ><input
          id="target"
          v-model.number="target"
          type="number"
          min="1"
          max="1000000000"
          step="1"
          required
        /><label class="checkbox-label"
          ><input v-model="consent" type="checkbox" /><span
            >Tôi đồng ý nhận cảnh báo trong inbox workspace khi dữ liệu đủ mới
            và đạt ngưỡng.</span
          ></label
        >
        <div class="source-note">
          <Icon name="info" :size="16" />
          <p>
            Giá quan sát mẫu, chưa gồm vận chuyển/voucher. Lịch sử bắt đầu từ
            lần quan sát đầu tiên.
          </p>
        </div>
        <button class="button primary full-width" :disabled="busy">
          <Icon name="eye" :size="18" />Bật theo dõi SKU
        </button>
      </form>
    </dialog>
    <dialog
      ref="detailDialog"
      class="modal detail-modal"
      @close="selected = null"
    >
      <template v-if="selectedFresh"
        ><div class="modal-heading">
          <div>
            <span class="eyebrow"
              >SYNTHETIC · {{ selectedFresh.fixture.variant }}</span
            >
            <h2>{{ selectedFresh.fixture.listing.title }}</h2>
          </div>
          <button
            class="icon-button"
            aria-label="Đóng chi tiết"
            @click="closeDetail"
          >
            <Icon name="close" />
          </button>
        </div>
        <div class="detail-price">
          <strong>{{ money(selectedFresh.current_price) }}</strong><span
            :class="[
              'badge',
              selectedFresh.freshness === 'fresh' ? 'available' : 'unverified',
            ]"
            >{{
              selectedFresh.freshness === 'fresh' ? 'Đủ mới' : 'Dữ liệu cũ'
            }}</span
          >
        </div>
        <PriceChart :history="history?.history ?? []" />
        <div class="score-explanation">
          <Icon name="chart" />
          <div>
            <strong
              >Deal score:
              {{
                selectedFresh.score_status === 'available'
                  ? `${selectedFresh.score}/100`
                  : selectedFresh.score_status === 'stale'
                    ? 'Stale'
                    : 'Unavailable'
              }}</strong
            >
            <p>
              {{
                selectedFresh.explanation ??
                'Đang chờ thêm quan sát. Cần ít nhất 2 mẫu trước đó cùng điều kiện.'
              }}
            </p>
            <p v-if="selectedFresh.baseline">
              Baseline {{ money(selectedFresh.baseline) }} ·
              {{ selectedFresh.samples }} mẫu · Exact SKU
            </p>
          </div>
        </div>
        <div class="detail-controls">
          <button
            class="button secondary"
            :disabled="busy"
            @click="toggle(selectedFresh, 'active')"
          >
            <Icon
              :name="selectedFresh.active ? 'pause' : 'play'"
              :size="16"
            />{{ selectedFresh.active ? 'Tạm dừng' : 'Tiếp tục' }}</button
          ><button
            class="button secondary"
            :disabled="busy"
            @click="toggle(selectedFresh, 'consent')"
          >
            <Icon name="bell" :size="16" />{{
              selectedFresh.consent ? 'Thu hồi opt-in' : 'Bật opt-in'
            }}
          </button>
        </div>
        <div class="simulation">
          <label for="scenario">Mô phỏng lần kiểm tra tiếp theo</label>
          <div>
            <select id="scenario" v-model="scenario">
              <option
                v-for="(label, value) in scenarioLabel"
                :key="value"
                :value="value"
              >
                {{ label }}
              </option></select
            ><button
              class="button primary"
              :disabled="busy || !selectedFresh.active"
              @click="simulate"
            >
              <Icon name="play" :size="14" />Chạy mô phỏng
            </button>
          </div>
          <p>
            Worker lấy giá từ fixture; retry tối đa 3 lần. Không gọi API thật.
          </p>
        </div>
        <p v-if="error" class="error-message" role="alert">{{ error }}</p>
        <div class="affiliate-box">
          <div>
            <strong>Affiliate link · Demo</strong>
            <p>Ghi nhận click, không suy ra conversion/commission.</p>
          </div>
          <button
            class="button secondary"
            :disabled="busy"
            @click="outbound(selectedFresh)"
          >
            Mở link demo <Icon name="external" :size="16" />
          </button></div
      ></template>
    </dialog>
  </div>
</template>
