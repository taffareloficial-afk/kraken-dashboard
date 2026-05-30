import { useState, useEffect, useRef } from 'react';
import { useTheme }               from './hooks/useTheme';
import { ThemeContext }            from './ThemeContext';
import { usePortfolio }           from './hooks/usePortfolio';
import { useLancamentos }         from './hooks/useLancamentos';
import { useProventosProximos }   from './hooks/useProventosProximos';
import { useSeedData }            from './hooks/useSeedData';
import { usePortfolioHistory }    from './hooks/usePortfolioHistory';
import { useOnboarding }          from './hooks/useOnboarding';
import { useAuth }                from './hooks/useAuth';
import { useSupabaseAuth }       from './hooks/useSupabaseAuth';
import { SUPABASE_ENABLED }      from './lib/supabase';
import Header                     from './components/Header';
import SyncBadge                  from './components/SyncBadge';
import TabNav                     from './components/TabNav';
import TickerTape                 from './components/TickerTape';
import ResumoTab                  from './components/ResumoTab';
import PatrimonioCard             from './components/PatrimonioCard';
import PatrimonioChart            from './components/PatrimonioChart';
import AllocationChart            from './components/AllocationChart';
import ProgressBars               from './components/ProgressBars';
import AssetTable                 from './components/AssetTable';
import SuggestionPanel            from './components/SuggestionPanel';
import LancamentosSection         from './components/lancamentos/LancamentosSection';
import ProventosProximos          from './components/ProventosProximos';
import MobileNav                  from './components/MobileNav';
import AssetDrawer                from './components/AssetDrawer';
import InsightsPanel              from './components/InsightsPanel';
import GoalTracker                from './components/GoalTracker';
import FocusMode                  from './components/FocusMode';
import BenchmarkCard              from './components/BenchmarkCard';
import OnboardingModal            from './components/OnboardingModal';
import AIAnalysisTab              from './components/AIAnalysisTab';
import { CheckCircle }            from 'lucide-react';

export default function App() {
  // ── Theme ─────────────────────────────────────────────────────────────────
  const { isDark, toggle: toggleTheme } = useTheme();

  // ── Onboarding ────────────────────────────────────────────────────────────
  const { visible: onboardingOpen, finish: finishOnboarding } = useOnboarding();

  // ── Auth — Supabase takes priority, falls back to Firebase ───────────────
  const fbAuth = useAuth();
  const sbAuth = useSupabaseAuth();

  // Pick whichever backend is configured (Supabase preferred)
  const activeAuth = SUPABASE_ENABLED ? sbAuth : fbAuth;

  const user        = activeAuth.user;
  const authLoading = activeAuth.loading ?? activeAuth.authLoading;
  const signIn      = SUPABASE_ENABLED ? sbAuth.signInWithGoogle : fbAuth.signIn;
  const signOut     = activeAuth.signOut;
  const FIREBASE_ENABLED = fbAuth.FIREBASE_ENABLED;
  const syncBackend = SUPABASE_ENABLED ? 'supabase' : 'firebase';

  // userId differs between backends: Supabase uses .id, Firebase uses .uid
  const userId = SUPABASE_ENABLED ? (sbAuth.user?.id ?? null) : (fbAuth.user?.uid ?? null);

  // ── Lançamentos (localStorage + cloud sync when signed in) ────────────────
  const {
    lancamentos,
    syncStatus,
    add:               addLancamento,
    addBulk:           addBulkLancamentos,
    mergeImport:       mergeImportLancamentos,
    remove:            removeLancamento,
    update:            updateLancamento,
    adjustedPortfolio,
    proventosStats,
  } = useLancamentos(userId, syncBackend);

  // ── Seed hook (no-op — kept for future use) ──────────────────────────────
  useSeedData();

  // ── Portfolio data ────────────────────────────────────────────────────────
  const {
    assets,
    loading,
    error,
    lastUpdate,
    trading,
    totalValue,
    dailyPnL,
    categoryValues,
    currentAllocation,
    refresh,
  } = usePortfolio(adjustedPortfolio);

  // ── Historical PnL + benchmarks + chart data ──────────────────────────────
  const {
    chartData,
    benchmarkSeries,
    weekly:    weeklyPnL,
    monthly:   monthlyPnL,
    yearly:    yearlyPnL,
    cdi,
    ibov,
    assetPerf,
    cdiByPeriod,
    loading:   histLoading,
  } = usePortfolioHistory(assets, lancamentos);

  // ── Proventos ─────────────────────────────────────────────────────────────
  // Only fetch proventos for tickers the user actually holds (non-Cripto, shares > 0).
  // adjustedPortfolio already filters shares > 0, so any ticker here has a real position.
  const proventosTickers = adjustedPortfolio
    .filter(a => a.type !== 'Cripto')
    .map(a => a.ticker);

  const proventosHook = useProventosProximos(proventosTickers);
  const { rows: proventosRows } = proventosHook;

  // ── Navigation ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('resumo');

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // ── Asset drawer ──────────────────────────────────────────────────────────
  const [selectedAsset, setSelectedAsset] = useState(null);

  // ── Focus mode ────────────────────────────────────────────────────────────
  const [focusMode, setFocusMode] = useState(false);

  // ── Auto-logging proventos ────────────────────────────────────────────────
  const lancamentosRef = useRef(lancamentos);
  useEffect(() => { lancamentosRef.current = lancamentos; }, [lancamentos]);

  const [autoLogNotif, setAutoLogNotif] = useState([]);

  useEffect(() => {
    if (!proventosRows.length || !adjustedPortfolio.length) return;

    const pastRows = proventosRows.filter(r => !r.isFuture && r.isProjected);
    const toAdd = [];

    for (const row of pastRows) {
      const monthKey = row.dataEx.slice(0, 7);
      const alreadyLogged = lancamentosRef.current.some(
        l =>
          l.category === 'provento' &&
          l.ticker   === row.ticker &&
          l.type     === row.tipo   &&
          l.date.startsWith(monthKey)
      );
      if (alreadyLogged) continue;

      const asset = adjustedPortfolio.find(a => a.ticker === row.ticker);
      if (!asset || asset.shares <= 0) continue;

      toAdd.push({
        category:  'provento',
        type:       row.tipo,
        date:       row.dataEx,
        ticker:     row.ticker,
        amount:     +(row.valor * asset.shares).toFixed(2),
        autoLogged: true,
      });
    }

    if (toAdd.length === 0) return;
    toAdd.forEach(entry => addLancamento(entry));
    setAutoLogNotif([...new Set(toAdd.map(e => e.ticker))]);
  }, [proventosRows]);

  useEffect(() => {
    if (!autoLogNotif.length) return;
    const t = setTimeout(() => setAutoLogNotif([]), 7000);
    return () => clearTimeout(t);
  }, [autoLogNotif]);

  // Close drawer on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setSelectedAsset(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Tab content renderer ──────────────────────────────────────────────────

  const renderTab = () => {
    switch (activeTab) {

      /* ── Resumo ──────────────────────────────────────────────────────── */
      case 'resumo':
        return (
          <ResumoTab
            assets={assets}
            totalValue={totalValue}
            dailyPnL={dailyPnL}
            loading={loading}
            histLoading={histLoading}
            categoryValues={categoryValues}
            currentAllocation={currentAllocation}
            chartData={chartData}
            benchmarkSeries={benchmarkSeries}
            assetPerf={assetPerf}
            cdiByPeriod={cdiByPeriod}
            lancamentos={lancamentos}
            proventosStats={proventosStats}
          />
        );

      /* ── Carteira ─────────────────────────────────────────────────────── */
      case 'carteira':
        return (
          <div className="stagger-item" style={{ '--i': 0 }}>
            <AssetTable
              assets={assets}
              loading={loading}
              onSelectAsset={setSelectedAsset}
              lancamentos={lancamentos}
            />
          </div>
        );

      /* ── Análise ──────────────────────────────────────────────────────── */
      case 'analise':
        return (
          <div className="two-col-grid analise-grid">
            {/* Coluna esquerda: Benchmark + Simulador */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="stagger-item" style={{ '--i': 0 }}>
                <BenchmarkCard
                  monthly={monthlyPnL}
                  yearly={yearlyPnL}
                  cdi={cdi}
                  ibov={ibov}
                  benchmarkSeries={benchmarkSeries}
                  loading={histLoading || loading}
                />
              </div>
              <div className="stagger-item" style={{ '--i': 1 }}>
                <SuggestionPanel
                  currentAllocation={currentAllocation}
                  categoryValues={categoryValues}
                  totalValue={totalValue}
                  assets={assets}
                />
              </div>
            </div>
            {/* Coluna direita: Insights + Meta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="stagger-item" style={{ '--i': 2 }}>
                <InsightsPanel
                  currentAllocation={currentAllocation}
                  categoryValues={categoryValues}
                  assets={assets}
                  lancamentos={lancamentos}
                  proventosRows={proventosRows}
                  totalValue={totalValue}
                  dailyPnL={dailyPnL}
                  loading={loading}
                />
              </div>
              <div className="stagger-item" style={{ '--i': 3 }}>
                <GoalTracker totalValue={totalValue} loading={loading} />
              </div>
            </div>
          </div>
        );

      /* ── Histórico ────────────────────────────────────────────────────── */
      case 'historico':
        return (
          <div className="stagger-item" style={{ '--i': 0 }}>
            <PatrimonioChart
              chartData={chartData}
              loading={histLoading}
              benchmarkSeries={benchmarkSeries}
              assetPerf={assetPerf}
              cdiByPeriod={cdiByPeriod}
              lancamentos={lancamentos}
              assets={assets}
            />
          </div>
        );

      /* ── Proventos ────────────────────────────────────────────────────── */
      case 'proventos':
        return (
          <div className="stagger-item" style={{ '--i': 0 }}>
            <ProventosProximos {...proventosHook} adjustedPortfolio={adjustedPortfolio} lancamentos={lancamentos} />
          </div>
        );

      /* ── Lançamentos ──────────────────────────────────────────────────── */
      case 'lancamentos':
        return (
          <div className="stagger-item" style={{ '--i': 0 }}>
            <LancamentosSection
              lancamentos={lancamentos}
              onAdd={addLancamento}
              onRemove={removeLancamento}
              onUpdate={updateLancamento}
              mergeImport={mergeImportLancamentos}
              proventosStats={proventosStats}
              assets={assets}
            />
          </div>
        );

      /* ── Análise IA v3 ───────────────────────────────────────────────── */
      case 'analise-ia-v3':
        return (
          <div className="stagger-item" style={{ '--i': 0 }}>
            <AIAnalysisTab
              assets={assets}
              lancamentos={lancamentos}
              currentAllocation={currentAllocation}
              categoryValues={categoryValues}
              totalValue={totalValue}
              dailyPnL={dailyPnL}
            />
          </div>
        );

      default:
        return null;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ThemeContext.Provider value={isDark}>
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)' }}>

      {/* Skip-to-content link (keyboard / screen-reader users) */}
      <a href="#main-content" className="skip-link">Pular para o conteúdo</a>

      {/* Sticky header */}
      <Header
        lastUpdate={lastUpdate}
        trading={trading}
        onRefresh={refresh}
        loading={loading}
        totalValue={totalValue}
        dailyPnL={dailyPnL}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onLogoClick={() => handleTabChange('resumo')}
        syncNode={
          <SyncBadge
            user={user}
            authLoading={authLoading}
            syncStatus={syncStatus}
            FIREBASE_ENABLED={FIREBASE_ENABLED}
            onSignIn={signIn}
            onSignInWithEmail={SUPABASE_ENABLED ? sbAuth.signInWithEmail : undefined}
            onSignOut={signOut}
          />
        }
      />

      {/* Desktop tab bar — sticky below header */}
      <TabNav activeTab={activeTab} onChange={handleTabChange} />

      {/* Ticker tape — portfolio assets scrolling below nav */}
      {!loading && <TickerTape assets={assets} />}

      {/* Error banner */}
      {error && (
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-4">
          <div
            className="text-sm px-4 py-3 rounded-lg"
            style={{ background: '#2d1215', border: '1px solid #6e1c1f', color: '#f85149' }}
          >
            ⚠ {error}
          </div>
        </div>
      )}

      {/* Tab content */}
      <main
        id="main-content"
        className="px-4 sm:px-6 lg:px-10 pt-4"
        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div key={activeTab} className="tab-content fade-in">
          {renderTab()}
        </div>

        <p className="text-center text-xs mt-6 pb-2" style={{ color: 'var(--c-b1)' }}>
          Kraken Dashboard · Yahoo Finance + CoinGecko
        </p>
      </main>

      {/* Mobile bottom navigation */}
      <MobileNav activeTab={activeTab} onChange={handleTabChange} />

      {/* Asset detail drawer (Carteira tab) */}
      {selectedAsset && (
        <AssetDrawer
          asset={selectedAsset}
          lancamentos={lancamentos}
          proventosRows={proventosRows}
          onClose={() => setSelectedAsset(null)}
        />
      )}

      {/* Focus mode overlay */}
      {focusMode && (
        <FocusMode
          totalValue={totalValue}
          dailyPnL={dailyPnL}
          onClose={() => setFocusMode(false)}
        />
      )}

      {/* Onboarding */}
      <OnboardingModal open={onboardingOpen} onDone={finishOnboarding} />

      {/* Auto-log toast */}
      {autoLogNotif.length > 0 && (
        <div
          style={{
            position:     'fixed',
            bottom:       24,
            right:        24,
            zIndex:       50,
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            padding:      '10px 16px',
            borderRadius: 10,
            background:   '#0d2c1a',
            border:       '1px solid #1a4731',
            color:        '#3fb950',
            fontSize:     13,
            fontWeight:   500,
            boxShadow:    '0 4px 24px rgba(0,0,0,0.5)',
            animation:    'fadeIn 0.3s ease',
          }}
        >
          <CheckCircle size={15} />
          <span>
            {autoLogNotif.length === 1
              ? `Provento de ${autoLogNotif[0]} registrado automaticamente`
              : `${autoLogNotif.length} proventos registrados automaticamente (${autoLogNotif.join(', ')})`
            }
          </span>
        </div>
      )}
    </div>
    </ThemeContext.Provider>
  );
}
