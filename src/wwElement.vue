<template>
  <div v-if="!content.portalTarget || (content.portalTarget === 'admin' && (!content.userRole || content.userRole === 'platform_admin'))" class="spread-df">
    <!-- Gate -->
    <div v-if="!content.accessToken || !content.userId" class="spread-df__gate">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <p class="spread-df__gate-text">Admin access required</p>
    </div>

    <div v-else-if="permissionChecked && !hasPlatformAdmin" class="spread-df__gate spread-df__gate--perm">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      <p class="spread-df__gate-text">Platform admin role required</p>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="spread-df__header">
        <div>
          <h2 class="spread-df__title">Failure Monitor</h2>
          <p class="spread-df__subtitle">Unresolved alerts · refreshes every {{ refreshIntervalSecs }}s</p>
        </div>
        <div class="spread-df__header-right">
          <!-- Time range filter -->
          <div class="spread-df__time-range">
            <button
              v-for="opt in TIME_RANGES"
              :key="opt.value"
              class="spread-df__range-btn"
              :class="{ 'spread-df__range-btn--active': timeRange === opt.value }"
              @click="timeRange = opt.value"
            >{{ opt.label }}</button>
          </div>
          <!-- Countdown indicator -->
          <div class="spread-df__countdown" :class="{ 'spread-df__countdown--soon': countdown <= 5 }">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {{ countdown }}s
          </div>
          <button class="spread-df__btn spread-df__btn--ghost" @click="pollNow" :disabled="loading" title="Refresh now">
            <div v-if="loading" class="spread-df__inline-spinner"></div>
            <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </button>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="spread-df__error" role="alert">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {{ error }}
        <button class="spread-df__dismiss" @click="error = null" aria-label="Dismiss error">×</button>
      </div>

      <!-- Health summary bar -->
      <div class="spread-df__health-bar">
        <div class="spread-df__health-segment spread-df__health-segment--critical">
          <span class="spread-df__health-count">{{ severityCounts.critical }}</span>
          <span class="spread-df__health-label">Critical</span>
        </div>
        <div class="spread-df__health-segment spread-df__health-segment--high">
          <span class="spread-df__health-count">{{ severityCounts.high }}</span>
          <span class="spread-df__health-label">High</span>
        </div>
        <div class="spread-df__health-segment spread-df__health-segment--warning">
          <span class="spread-df__health-count">{{ severityCounts.warning }}</span>
          <span class="spread-df__health-label">Warning</span>
        </div>
        <div class="spread-df__health-segment spread-df__health-segment--info">
          <span class="spread-df__health-count">{{ severityCounts.info }}</span>
          <span class="spread-df__health-label">Info</span>
        </div>
        <div class="spread-df__health-total">
          <span class="spread-df__health-count">{{ filteredAlerts.length }}</span>
          <span class="spread-df__health-label">Total</span>
        </div>
      </div>

      <!-- Tabs -->
      <div class="spread-df__tabs" role="tablist">
        <button role="tab" class="spread-df__tab" :class="{ 'spread-df__tab--active': activeTab === 'geo' }" :aria-selected="activeTab === 'geo'" @click="activeTab = 'geo'">
          Geo Sync Alerts
          <span v-if="filteredAlerts.length" class="spread-df__tab-badge spread-df__tab-badge--geo">{{ filteredAlerts.length }}</span>
        </button>
        <button role="tab" class="spread-df__tab" :class="{ 'spread-df__tab--active': activeTab === 'system' }" :aria-selected="activeTab === 'system'" @click="activeTab = 'system'">
          System Failures
          <span class="spread-df__tab-badge spread-df__tab-badge--stub">Coming soon</span>
        </button>
      </div>

      <!-- ── Tab: Geo Sync Alerts ──────────────────────────────────── -->
      <div v-if="activeTab === 'geo'" class="spread-df__tab-panel">
        <!-- Skeleton -->
        <div v-if="loading && !allAlerts.length" class="spread-df__skeleton">
          <div v-for="i in 3" :key="i" class="spread-df__skeleton-row"></div>
        </div>

        <!-- Empty -->
        <div v-else-if="!filteredAlerts.length" class="spread-df__empty">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          <p>No unresolved alerts in the selected time range.</p>
        </div>

        <!-- Alert list -->
        <transition-group v-else tag="ul" name="spread-df-alert" class="spread-df__alert-list" role="list">
          <li
            v-for="alert in filteredAlerts"
            :key="alert.id"
            class="spread-df__alert-item"
            :class="`spread-df__alert-item--${alert.severity || 'info'}`"
          >
            <div class="spread-df__alert-main">
              <div class="spread-df__alert-top">
                <span class="spread-df__sev-badge" :class="`spread-df__sev-badge--${alert.severity || 'info'}`">
                  {{ alert.severity || 'info' }}
                </span>
                <span class="spread-df__alert-dataset">{{ alert.dataset_name }}</span>
                <span class="spread-df__alert-type">{{ formatAlertType(alert.alert_type) }}</span>
                <span class="spread-df__alert-time">{{ relativeTime(alert.created_at) }}</span>
              </div>
              <p class="spread-df__alert-msg">{{ alert.message }}</p>
              <pre v-if="alert.context" class="spread-df__alert-ctx">{{ formatContext(alert.context) }}</pre>
            </div>
            <div class="spread-df__alert-actions">
              <button
                class="spread-df__ack-btn"
                :disabled="acknowledgingIds.includes(alert.id)"
                @click="acknowledgeAlert(alert)"
              >
                <div v-if="acknowledgingIds.includes(alert.id)" class="spread-df__inline-spinner"></div>
                <span v-else>Acknowledge</span>
              </button>
            </div>
          </li>
        </transition-group>
      </div>

      <!-- ── Tab: System Failures (stub) ──────────────────────────── -->
      <div v-if="activeTab === 'system'" class="spread-df__tab-panel">
        <div class="spread-df__stub">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <p class="spread-df__stub-title">System failure tracking</p>
          <p class="spread-df__stub-body">Edge Function errors, Make automation failures, and cron job misses will appear here in Phase 6.</p>
        </div>
      </div>

    </template>
  </div>
</template>

<script>
/* ── Mock ──────────────────────────────────────────────────────────────── */
const MOCK_ALERTS = [
  { id: 'a1', dataset_name: 'vic_suburbs',  alert_type: 'import_failed',   severity: 'critical', message: 'HTTP 404 fetching source GeoJSON. Check source URL.', context: { url: 'https://geo.data.gov.au/vic_suburbs.geojson', status: 404 }, status: 'open', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'a2', dataset_name: 'qld_postcodes', alert_type: 'stale_dataset',  severity: 'warning',  message: 'Dataset has not been refreshed in 10 days. SLO threshold is 8 days.', context: null, status: 'open', created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 'a3', dataset_name: 'nsw_localities', alert_type: 'feature_count_drop', severity: 'high', message: 'Processed feature count dropped by 12% compared to previous run.', context: { prev: 12581, current: 11065, drop_pct: 12.1 }, status: 'open', created_at: new Date(Date.now() - 12000000).toISOString() },
];
const TIME_RANGES = [
  { label: '1h',  value: '1h',  ms: 3600000 },
  { label: '6h',  value: '6h',  ms: 21600000 },
  { label: '24h', value: '24h', ms: 86400000 },
  { label: '7d',  value: '7d',  ms: 604800000 },
];

/* ── Inline client ─────────────────────────────────────────────────────── */
function createSpreadClient(url, anonKey, token) {
  const headers = { 'Content-Type': 'application/json', apikey: anonKey };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return {
    async rpc(fn, params = {}) {
      const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(params) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || res.statusText); }
      return res.json();
    },
  };
}

export default {
  props: {
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
    content:        { type: Object, required: true },
    wwFrontState:   { type: Object, required: true },
    wwElementState: { type: Object, required: true },
  },
  emits: ['trigger-event', 'update:content'],

  setup() {
    const { value: failureCount, setValue: setFailureCount } =
      wwLib.wwVariable.useComponentVariable({ uid: 'failureCount', name: 'Failure Count', type: 'number', defaultValue: 0 });
    return { failureCount, setFailureCount };
  },

  data() {
    return {
      TIME_RANGES,
      loading:           false,
      permissionChecked: false,
      hasPlatformAdmin:  false,
      allAlerts:         [],
      acknowledgingIds:  [],
      activeTab:         'geo',
      timeRange:         '24h',
      error:             null,
      countdown:         30,
      _pollTimer:        null,
      _countdownTimer:   null,
    };
  },

  computed: {
    /* wwEditor:start */
    isEditorMode() { return !!this.wwEditorState; },
    /* wwEditor:end */
    refreshIntervalSecs() { return this.content?.refreshInterval || 30; },
    timeRangeCutoff() {
      const opt = TIME_RANGES.find(r => r.value === this.timeRange) || { ms: 86400000 };
      return new Date(Date.now() - opt.ms).toISOString();
    },
    filteredAlerts() {
      return this.allAlerts.filter(a => a.created_at >= this.timeRangeCutoff);
    },
    severityCounts() {
      const counts = { critical: 0, high: 0, warning: 0, info: 0 };
      this.filteredAlerts.forEach(a => {
        const s = a.severity || 'info';
        if (s in counts) counts[s]++;
        else counts.info++;
      });
      return counts;
    },
  },

  watch: {
    'content.refreshTrigger'() { this.pollNow(); },
    filteredAlerts(v) { this.setFailureCount(v.length); },
    'content.refreshInterval'() {
      clearInterval(this._pollTimer);
      clearInterval(this._countdownTimer);
      this._startPolling();
    },
  },

  mounted() {
    /* wwEditor:start */
    if (this.isEditorMode) {
      this.hasPlatformAdmin = true;
      this.permissionChecked = true;
      this.allAlerts = MOCK_ALERTS;
      this.setFailureCount(MOCK_ALERTS.length);
      return;
    }
    /* wwEditor:end */
    this.checkRole().then(() => { if (this.hasPlatformAdmin) { this.loadAlerts(); this._startPolling(); } });
  },

  beforeUnmount() {
    clearInterval(this._pollTimer);
    clearInterval(this._countdownTimer);
  },

  methods: {
    client() {
      return createSpreadClient(this.content?.supabaseUrl, this.content?.supabaseAnonKey, this.content?.accessToken);
    },

    async checkRole() {
      try {
        const ok = await this.client().rpc('has_role', { p_user_id: this.content.userId, p_role_key: 'platform_admin' });
        this.hasPlatformAdmin = !!ok;
      } catch (_) { this.hasPlatformAdmin = true; }
      this.permissionChecked = true;
    },

    _startPolling() {
      const secs = this.refreshIntervalSecs;
      this.countdown = secs;
      // Countdown ticker
      this._countdownTimer = setInterval(() => {
        this.countdown = this.countdown <= 1 ? secs : this.countdown - 1;
      }, 1000);
      // Data poll
      this._pollTimer = setInterval(() => { this.countdown = secs; this.loadAlerts(); }, secs * 1000);
    },

    pollNow() { this.countdown = this.refreshIntervalSecs; this.loadAlerts(); },

    async loadAlerts() {
      if (!this.content.accessToken || !this.content.userId) return;
      this.loading = true; this.error = null;
      try {
        const alerts = await this.client().rpc('get_geo_sync_alerts', {
          p_user_id:         this.content.userId,
          p_dataset_name:    null,
          p_unresolved_only: true,
          p_limit:           100,
        });
        this.allAlerts = Array.isArray(alerts) ? alerts : [];
        this.setFailureCount(this.filteredAlerts.length);
        this.$emit('trigger-event', { name: 'failures:loaded', event: { total: this.allAlerts.length } });
      } catch (e) {
        this.error = e.message || 'Failed to load alerts';
        this.$emit('trigger-event', { name: 'failures:error', event: { message: this.error } });
      } finally { this.loading = false; }
    },

    async acknowledgeAlert(alert) {
      if (this.acknowledgingIds.includes(alert.id)) return;
      this.acknowledgingIds = [...this.acknowledgingIds, alert.id];
      try {
        await this.client().rpc('acknowledge_geo_alert', { p_user_id: this.content.userId, p_alert_id: alert.id });
        this.allAlerts = this.allAlerts.filter(a => a.id !== alert.id);
        this.setFailureCount(this.filteredAlerts.length);
        this.$emit('trigger-event', { name: 'failures:acknowledged', event: { alertId: alert.id, datasetName: alert.dataset_name } });
      } catch (e) { this.error = e.message || 'Acknowledge failed'; } finally {
        this.acknowledgingIds = this.acknowledgingIds.filter(id => id !== alert.id);
      }
    },

    relativeTime(ts) {
      try {
        const diff = Date.now() - new Date(ts).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
      } catch (_) { return ''; }
    },

    formatAlertType(t) {
      if (!t) return '';
      return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    },

    formatContext(ctx) {
      if (!ctx) return '';
      try { return JSON.stringify(typeof ctx === 'string' ? JSON.parse(ctx) : ctx, null, 2); } catch (_) { return String(ctx); }
    },
  },
};
</script>

<style scoped>
.spread-df {
  --spread-primary:    #4B162D;
  --spread-accent:     #CE6632;
  --spread-dark-grey:  #2B2B2B;
  --spread-mid-grey:   #4B5563;
  --spread-light-grey: #6B7280;
  --spread-border:     #F3EADF;
  --spread-background: #FBFAF8;
  --spread-success:    #16A34A;
  --spread-warning:    #D97706;
  --spread-error:      #D14343;
  --spread-radius:     12px;
  --spread-radius-sm:  8px;
  --spread-font:       ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;

  font-family: var(--spread-font);
  width: 100%;
  box-sizing: border-box;
  padding: 1.5rem;
  background: var(--spread-background);
  max-width: 1440px;
  margin-inline: auto;
  position: relative;
}

.spread-df *, .spread-df *::before, .spread-df *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Gate */
.spread-df__gate { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 200px; color: var(--spread-mid-grey); }
.spread-df__gate--perm { color: var(--spread-error); }
.spread-df__gate-text { font-size: 14px; font-weight: 500; }

/* Header */
.spread-df__header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem; }
.spread-df__title { font-size: 1.375rem; font-weight: 800; color: var(--spread-primary); }
.spread-df__subtitle { font-size: 0.8125rem; color: var(--spread-light-grey); margin-top: 2px; }
.spread-df__header-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* Time range */
.spread-df__time-range { display: flex; gap: 2px; background: var(--spread-border); border-radius: 8px; padding: 2px; }
.spread-df__range-btn { padding: 5px 10px; background: none; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--spread-mid-grey); transition: all 0.12s; font-family: inherit; }
.spread-df__range-btn--active { background: #fff; color: var(--spread-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

/* Countdown */
.spread-df__countdown { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--spread-light-grey); padding: 5px 9px; background: var(--spread-background); border: 1px solid var(--spread-border); border-radius: var(--spread-radius-sm); white-space: nowrap; }
.spread-df__countdown--soon { color: var(--spread-warning); border-color: #FDE68A; background: #FFFBEB; }

/* Error */
.spread-df__error { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: var(--spread-radius-sm); color: var(--spread-error); font-size: 13px; margin-bottom: 1rem; }
.spread-df__dismiss { margin-left: auto; background: none; border: none; cursor: pointer; color: inherit; font-size: 18px; line-height: 1; }

/* Health summary bar */
.spread-df__health-bar { display: flex; gap: 0; margin-bottom: 1.25rem; background: #fff; border: 1px solid var(--spread-border); border-radius: var(--spread-radius-sm); overflow: hidden; }
.spread-df__health-segment,
.spread-df__health-total { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 8px; border-right: 1px solid var(--spread-border); gap: 2px; }
.spread-df__health-total { border-right: none; background: var(--spread-background); }
.spread-df__health-segment--critical { border-top: 3px solid var(--spread-error); }
.spread-df__health-segment--high     { border-top: 3px solid #EF4444; }
.spread-df__health-segment--warning  { border-top: 3px solid var(--spread-warning); }
.spread-df__health-segment--info     { border-top: 3px solid #3B82F6; }
.spread-df__health-count { font-size: 1.375rem; font-weight: 800; color: var(--spread-dark-grey); }
.spread-df__health-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--spread-light-grey); white-space: nowrap; }

/* Tabs */
.spread-df__tabs { display: flex; gap: 0; border-bottom: 1px solid var(--spread-border); margin-bottom: 1rem; }
.spread-df__tab { padding: 10px 16px; background: none; border: none; border-bottom: 2px solid transparent; font-size: 14px; font-weight: 600; color: var(--spread-light-grey); cursor: pointer; display: flex; align-items: center; gap: 7px; transition: all 0.15s; font-family: inherit; margin-bottom: -1px; }
.spread-df__tab--active { color: var(--spread-primary); border-bottom-color: var(--spread-primary); }
.spread-df__tab:hover:not(.spread-df__tab--active) { color: var(--spread-mid-grey); }
.spread-df__tab-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 8px; }
.spread-df__tab-badge--geo  { background: var(--spread-error); color: #fff; }
.spread-df__tab-badge--stub { background: var(--spread-border); color: var(--spread-mid-grey); }

/* Tab panel */
.spread-df__tab-panel { display: flex; flex-direction: column; gap: 1rem; }

/* Skeleton */
.spread-df__skeleton { display: flex; flex-direction: column; gap: 6px; }
.spread-df__skeleton-row { height: 80px; background: linear-gradient(90deg, #f0ebe6 25%, #e8e2dc 50%, #f0ebe6 75%); background-size: 200% 100%; border-radius: var(--spread-radius-sm); animation: spread-df-shimmer 1.5s infinite; }
@keyframes spread-df-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Empty */
.spread-df__empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 2rem; color: var(--spread-light-grey); font-size: 13px; text-align: center; background: #fff; border: 1px solid var(--spread-border); border-radius: var(--spread-radius-sm); }

/* Alert list */
.spread-df__alert-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }

/* Transition for removal */
.spread-df-alert-leave-active { transition: all 0.35s ease; }
.spread-df-alert-leave-to { opacity: 0; transform: translateX(40px); max-height: 0; margin: 0; padding: 0; }
.spread-df-alert-enter-active { transition: all 0.25s ease; }
.spread-df-alert-enter-from { opacity: 0; transform: translateY(-10px); }

.spread-df__alert-item {
  display: flex; align-items: flex-start; gap: 12px;
  background: #fff; border: 1px solid var(--spread-border);
  border-left: 3px solid transparent; border-radius: var(--spread-radius-sm); padding: 12px 16px;
}
.spread-df__alert-item--critical { border-left-color: var(--spread-error); }
.spread-df__alert-item--high     { border-left-color: #EF4444; }
.spread-df__alert-item--warning  { border-left-color: var(--spread-warning); }
.spread-df__alert-item--info     { border-left-color: #3B82F6; }

.spread-df__alert-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.spread-df__alert-top { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.spread-df__sev-badge { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; white-space: nowrap; }
.spread-df__sev-badge--critical,
.spread-df__sev-badge--high { background: #FEE2E2; color: #7F1D1D; }
.spread-df__sev-badge--warning { background: #FEF3C7; color: #78350F; }
.spread-df__sev-badge--info    { background: #DBEAFE; color: #1E40AF; }

.spread-df__alert-dataset { font-size: 12px; font-weight: 700; color: var(--spread-primary); background: #FDEEF3; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }
.spread-df__alert-type    { font-size: 12px; color: var(--spread-mid-grey); }
.spread-df__alert-time    { font-size: 11px; color: var(--spread-light-grey); margin-left: auto; white-space: nowrap; }

.spread-df__alert-msg { font-size: 13.5px; color: var(--spread-dark-grey); line-height: 1.5; }
.spread-df__alert-ctx { font-size: 11px; color: var(--spread-mid-grey); background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

.spread-df__alert-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
.spread-df__ack-btn { padding: 6px 12px; background: none; border: 1px solid var(--spread-border); border-radius: var(--spread-radius-sm); font-size: 12px; font-weight: 600; cursor: pointer; color: var(--spread-mid-grey); display: flex; align-items: center; gap: 6px; transition: all 0.12s; white-space: nowrap; font-family: inherit; }
.spread-df__ack-btn:hover:not(:disabled) { border-color: var(--spread-success); color: var(--spread-success); background: #DCFCE7; }
.spread-df__ack-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Stub panel */
.spread-df__stub { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 3rem 1rem; color: var(--spread-light-grey); text-align: center; background: #fff; border: 1px solid var(--spread-border); border-radius: var(--spread-radius-sm); }
.spread-df__stub-title { font-size: 15px; font-weight: 700; color: var(--spread-mid-grey); }
.spread-df__stub-body  { font-size: 13px; line-height: 1.5; max-width: 380px; }

/* Buttons */
.spread-df__btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: var(--spread-radius-sm); font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.12s; font-family: inherit; }
.spread-df__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.spread-df__btn--ghost { background: none; color: var(--spread-mid-grey); border-color: var(--spread-border); }
.spread-df__btn--ghost:hover:not(:disabled) { border-color: var(--spread-mid-grey); }

/* Spinners */
.spread-df__inline-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid var(--spread-border); border-top-color: var(--spread-accent); border-radius: 50%; animation: spread-df-spin 0.6s linear infinite; flex-shrink: 0; }
@keyframes spread-df-spin { to { transform: rotate(360deg); } }

/* Responsive */
@media (max-width: 599px) {
  .spread-df { padding: 1rem; }
  .spread-df__health-bar { flex-wrap: wrap; }
  .spread-df__health-segment, .spread-df__health-total { flex: none; width: 50%; }
  .spread-df__alert-item { flex-direction: column; }
  .spread-df__alert-actions { flex-direction: row; align-self: stretch; }
}
@media (max-width: 479px) {
  .spread-df { padding: 0.75rem; }
}
@media (min-width: 480px) {
  .spread-df { padding: 1rem; }
}
@media (min-width: 768px) {
  .spread-df { padding: 1.25rem; }
}
@media (min-width: 1024px) {
  .spread-df { padding: 1.5rem 2rem; }
}
@media (min-width: 1280px) {
  .spread-df { padding: 1.5rem 2.5rem; }
}

/* ── Dark mode ─────────────────────────────────────────────────────── */
:global(html.dark) .spread-df {
  background: #000000;
  color: #f5f0eb;
  --spread-cream: #18181b;
  --spread-border: rgba(230, 216, 202, 0.12);
  --spread-text-primary: #f5f0eb;
  --spread-text-secondary: rgba(230, 216, 202, 0.65);
  --spread-text-muted: rgba(230, 216, 202, 0.4);
}
:global(html.dark) .spread-df__card { background: #18181b; border-color: rgba(230,216,202,0.12); }
:global(html.dark) .spread-df__row-title { color: #f5f0eb; }
:global(html.dark) .spread-df__row-meta { color: rgba(230,216,202,0.5); }
:global(html.dark) .spread-df__row-detail { color: rgba(230,216,202,0.65); }
:global(html.dark) .spread-df__badge--error { background: rgba(209,67,67,0.12); color: #fca5a5; }
:global(html.dark) .spread-df__badge--warn { background: rgba(250,204,21,0.12); color: #fbbf24; }
:global(html.dark) .spread-df__divider { border-color: rgba(230,216,202,0.08); }
:global(html.dark) .spread-df__empty { color: rgba(230,216,202,0.4); }
:global(html.dark) .spread-df__section-title { color: #f5f0eb; }
:global(html.dark) .spread-df input { background: #160c11; border-color: rgba(230,216,202,0.2); color: #f5f0eb; }
</style>
