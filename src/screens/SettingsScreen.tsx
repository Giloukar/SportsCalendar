import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, RefreshCw, RotateCcw, Check, CheckCircle2, Sun, Moon, Monitor,
  ChevronDown, CheckSquare, Square, Activity, Tv2, ChevronRight,
} from 'lucide-react';
import { usePreferencesStore } from '@store/preferencesStore';
import { useIptvStore } from '@store/iptvStore';
import { SPORTS_BY_CATEGORY, SPORTS_CATALOG, TIER_ORDER, TIER_LABELS, TIER_DESCRIPTIONS } from '@constants/sports';
import { ThemeMode, SportId } from '@app-types/index';
import { TIER_COLORS } from '@theme/index';
import { SportIcon } from '@components/SportIcon';
import { syncService } from '@services/syncService';
import { notificationService } from '@services/notificationService';

export function SettingsScreen() {
  const preferences = usePreferencesStore((s) => s.preferences);
  const toggleSport = usePreferencesStore((s) => s.toggleSport);
  const setSelectedSports = usePreferencesStore((s) => s.setSelectedSports);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const updateNotifications = usePreferencesStore((s) => s.updateNotifications);
  const setMinTier = usePreferencesStore((s) => s.setMinTier);
  const resetPreferences = usePreferencesStore((s) => s.resetPreferences);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncStats, setSyncStats] = useState(syncService.getLastStats());

  // Sections pliables
  const [sportsOpen, setSportsOpen] = useState(true);
  const [esportsOpen, setEsportsOpen] = useState(true);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleTestNotification = async () => {
    const ok = await notificationService.requestPermission();
    if (!ok) {
      showMessage('error', 'Permission refusée par le navigateur');
      return;
    }
    setTimeout(() => {
      try {
        new Notification('Sport Calendar', {
          body: '🎉 Les notifications fonctionnent !',
          icon: '/icon-192.png',
        });
      } catch {}
    }, 1000);
    showMessage('success', 'Notification envoyée dans 1 seconde');
  };

  const handleFullSync = async () => {
    try {
      const result = await syncService.synchronize();
      setSyncStats(result);
      const parts = [`${result.total} événements`];
      if (result.duplicatesRemoved > 0) parts.push(`${result.duplicatesRemoved} doublons supprimés`);
      showMessage('success', parts.join(' · '));
    } catch (error: any) {
      showMessage('error', error?.message ?? 'Erreur de synchronisation');
    }
  };

  const handleReset = () => {
    if (confirm('Réinitialiser toutes les préférences ?')) {
      resetPreferences();
      showMessage('success', 'Préférences réinitialisées');
    }
  };

  /** Coche/décoche tous les sports d'une catégorie */
  const toggleAllSports = (category: 'sport' | 'esport') => {
    const categoryIds = SPORTS_BY_CATEGORY[category].map((s) => s.id);
    const current = preferences.selectedSports;
    const allSelected = categoryIds.every((id) => current.includes(id));

    if (allSelected) {
      // Tout décocher dans cette catégorie
      setSelectedSports(current.filter((id) => !categoryIds.includes(id)));
    } else {
      // Tout cocher dans cette catégorie
      const toAdd = categoryIds.filter((id) => !current.includes(id));
      setSelectedSports([...current, ...toAdd]);
    }
  };

  const isAllSelected = (category: 'sport' | 'esport') => {
    const categoryIds = SPORTS_BY_CATEGORY[category].map((s) => s.id);
    return categoryIds.every((id) => preferences.selectedSports.includes(id));
  };

  const countSelected = (category: 'sport' | 'esport') => {
    return SPORTS_BY_CATEGORY[category].filter((s) => preferences.selectedSports.includes(s.id)).length;
  };

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-6 md:pt-10 pb-4">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white">
          Paramètres
        </h1>
      </div>

      {/* Message feedback */}
      {message && (
        <div
          className={`mx-4 mb-4 px-4 py-3 rounded-lg text-sm font-semibold ${
            message.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="px-4 space-y-4 max-w-3xl">
        {/* ============== Sports traditionnels ============== */}
        <CollapsibleSection
          title="Sports traditionnels"
          subtitle={`${countSelected('sport')} / ${SPORTS_BY_CATEGORY.sport.length} sélectionnés`}
          isOpen={sportsOpen}
          onToggle={() => setSportsOpen(!sportsOpen)}
          headerAction={
            <button
              onClick={(e) => { e.stopPropagation(); toggleAllSports('sport'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              {isAllSelected('sport') ? <Square size={14} /> : <CheckSquare size={14} />}
              {isAllSelected('sport') ? 'Tout décocher' : 'Tout cocher'}
            </button>
          }
        >
          <SportsGrid
            sports={SPORTS_BY_CATEGORY.sport.map((s) => s.id)}
            selectedSports={preferences.selectedSports}
            onToggle={toggleSport}
          />
        </CollapsibleSection>

        {/* ============== Esports ============== */}
        <CollapsibleSection
          title="Esports"
          subtitle={`${countSelected('esport')} / ${SPORTS_BY_CATEGORY.esport.length} sélectionnés`}
          isOpen={esportsOpen}
          onToggle={() => setEsportsOpen(!esportsOpen)}
          headerAction={
            <button
              onClick={(e) => { e.stopPropagation(); toggleAllSports('esport'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
            >
              {isAllSelected('esport') ? <Square size={14} /> : <CheckSquare size={14} />}
              {isAllSelected('esport') ? 'Tout décocher' : 'Tout cocher'}
            </button>
          }
        >
          <SportsGrid
            sports={SPORTS_BY_CATEGORY.esport.map((s) => s.id)}
            selectedSports={preferences.selectedSports}
            onToggle={toggleSport}
          />
        </CollapsibleSection>

        {/* ============== Importance minimum ============== */}
        <Section title="Importance minimum" subtitle="Seuil pour les notifications">
          <div className="space-y-2">
            {TIER_ORDER.map((tier) => {
              const isSelected = preferences.minTier === tier;
              const colors = TIER_COLORS[tier];
              return (
                <button
                  key={tier}
                  onClick={() => setMinTier(tier)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 text-left transition-all ${
                    isSelected
                      ? `border-2 ${colors.border}`
                      : 'border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center text-white font-bold text-sm`}>
                    {tier}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 dark:text-white text-sm">
                      {TIER_LABELS[tier]}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {TIER_DESCRIPTIONS[tier]}
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 size={22} className={colors.text} />}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ============== Notifications ============== */}
        <Section title="Notifications">
          <ToggleRow
            title="Activer les notifications"
            subtitle="Rappels avant les matches"
            value={preferences.notifications.enabled}
            onChange={(v) => updateNotifications({ enabled: v })}
          />
          <ToggleRow
            title="Uniquement Tier S/A"
            subtitle="Limiter aux événements majeurs"
            value={preferences.notifications.onlyImportant}
            onChange={(v) => updateNotifications({ onlyImportant: v })}
          />
          <ToggleRow
            title="Notifier au coup d'envoi"
            subtitle="Alerte au début des matches"
            value={preferences.notifications.onLiveStart}
            onChange={(v) => updateNotifications({ onLiveStart: v })}
          />

          <div className="mt-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Rappels avant l'événement
            </div>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 30, 60, 120, 1440].map((mins) => {
                const active = preferences.notifications.reminderMinutes.includes(mins);
                const label = mins < 60 ? `${mins} min` : mins === 1440 ? '1 jour' : `${mins / 60} h`;
                return (
                  <button
                    key={mins}
                    onClick={() => {
                      const current = preferences.notifications.reminderMinutes;
                      const next = active
                        ? current.filter((m) => m !== mins)
                        : [...current, mins].sort((a, b) => b - a);
                      updateNotifications({ reminderMinutes: next });
                    }}
                    className={`px-3 py-1.5 rounded-full border-2 text-xs font-bold transition-colors ${
                      active
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-blue-600 text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <ActionButton
            icon={<Bell size={18} />}
            label="Tester une notification"
            onClick={handleTestNotification}
            color="blue"
          />
        </Section>

        {/* ============== Apparence ============== */}
        <Section title="Apparence">
          <div className="space-y-2">
            {(
              [
                { mode: 'auto' as ThemeMode, label: 'Automatique (système)', Icon: Monitor },
                { mode: 'light' as ThemeMode, label: 'Clair', Icon: Sun },
                { mode: 'dark' as ThemeMode, label: 'Sombre', Icon: Moon },
              ]
            ).map(({ mode, label, Icon }) => {
              const isActive = preferences.theme === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setTheme(mode)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 text-left transition-all ${
                    isActive
                      ? 'border-2 border-blue-600'
                      : 'border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Icon size={22} className="text-blue-600 dark:text-blue-400" />
                  <span className="flex-1 font-semibold text-slate-900 dark:text-white text-sm">
                    {label}
                  </span>
                  {isActive && <CheckCircle2 size={22} className="text-blue-600 dark:text-blue-400" />}
                </button>
              );
            })}
          </div>
        </Section>

        {/* ============== IPTV intégré ============== */}
        <Section title="IPTV">
          <IptvLinkButton />
        </Section>

        {/* ============== Diagnostic (nouveau) ============== */}
        <CollapsibleSection
          title="Diagnostic"
          subtitle={syncStats ? `Dernière sync : ${syncStats.total} événements` : 'Aucune sync effectuée'}
          isOpen={diagnosticOpen}
          onToggle={() => setDiagnosticOpen(!diagnosticOpen)}
          headerAction={<Activity size={18} className="text-blue-600 dark:text-blue-400" />}
        >
          <div className="space-y-2">
            <ActionButton
              icon={<RefreshCw size={18} />}
              label="Lancer une synchronisation complète"
              onClick={handleFullSync}
              color="blue"
            />

            {syncStats && (
              <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <DiagRow label="Total événements" value={String(syncStats.total)} />
                <DiagRow label="Doublons supprimés" value={String(syncStats.duplicatesRemoved)} />
                <DiagRow label="Durée" value={`${(syncStats.durationMs / 1000).toFixed(1)}s`} />
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">Par provider :</div>
                  {Object.entries(syncStats.byProvider).map(([provider, count]) => (
                    <DiagRow
                      key={provider}
                      label={provider}
                      value={count === 0 ? '❌ 0 (vérifier config)' : `✓ ${count}`}
                    />
                  ))}
                </div>
                {syncStats.errors.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="font-bold text-red-600 dark:text-red-400 mb-1">Erreurs :</div>
                    {syncStats.errors.map((err, i) => (
                      <div key={i} className="text-red-600 dark:text-red-400 text-[11px]">
                        {err.provider}: {err.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200">
              <div className="font-bold mb-1">💡 Esports vides ?</div>
              <ol className="list-decimal list-inside space-y-1">
                <li>Vérifiez que la variable <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">PANDASCORE_API_KEY</code> est bien configurée sur Netlify (Site configuration → Environment variables)</li>
                <li>Redéployez ensuite (Deploys → Trigger deploy)</li>
                <li>Cochez bien les esports souhaités ci-dessus</li>
                <li>Relancez une sync avec le bouton ci-dessus</li>
              </ol>
            </div>
          </div>
        </CollapsibleSection>

        {/* ============== Avancé ============== */}
        <Section title="Avancé">
          <ActionButton
            icon={<RotateCcw size={18} />}
            label="Réinitialiser les préférences"
            onClick={handleReset}
            color="red"
          />
        </Section>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-8">
          Sport Calendar · version 1.1.0
        </p>
      </div>
    </div>
  );
}

// ============= Sous-composants =============

function SportsGrid({
  sports, selectedSports, onToggle,
}: {
  sports: SportId[];
  selectedSports: SportId[];
  onToggle: (id: SportId) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
      {sports.map((sportId) => {
        const isSelected = selectedSports.includes(sportId);
        return (
          <SportCard key={sportId} sportId={sportId} isSelected={isSelected} onToggle={onToggle} />
        );
      })}
    </div>
  );
}

function SportCard({
  sportId, isSelected, onToggle,
}: {
  sportId: SportId;
  isSelected: boolean;
  onToggle: (id: SportId) => void;
}) {
  const meta = SPORTS_CATALOG[sportId];
  return (
    <button
      onClick={() => onToggle(sportId)}
      className="relative flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all"
      style={{
        backgroundColor: isSelected ? `${meta.color}18` : 'transparent',
        borderColor: isSelected ? meta.color : 'var(--card-border, #e2e8f0)',
      }}
    >
      <SportIcon sportId={sportId} size={22} withBackground={false} />
      <span
        className={`text-xs font-semibold text-center leading-tight ${
          isSelected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {meta.label}
      </span>
      {isSelected && (
        <span
          className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: meta.color }}
        >
          <Check size={10} className="text-white" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CollapsibleSection({
  title, subtitle, isOpen, onToggle, headerAction, children,
}: {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 pb-2 text-left"
      >
        <ChevronDown
          size={22}
          className={`text-slate-500 dark:text-slate-400 transition-transform ${isOpen ? '' : '-rotate-90'}`}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {headerAction}
      </button>
      {isOpen && <div className="pt-2">{children}</div>}
    </div>
  );
}

function ToggleRow({
  title, subtitle, value, onChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <div className="flex-1">
        <div className="font-semibold text-slate-900 dark:text-white text-sm">{title}</div>
        {subtitle && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</div>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          value ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function ActionButton({
  icon, label, onClick, color,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: 'blue' | 'red';
}) {
  const styles = color === 'red'
    ? 'border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
    : 'border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20';

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-white dark:bg-slate-800 border-2 font-bold text-sm transition-colors ${styles}`}
    >
      {icon}
      {label}
    </button>
  );
}

function DiagRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className="font-mono font-semibold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

// ============== Lien vers la page IPTV ==============

function IptvLinkButton() {
  const navigate = useNavigate();
  const channelsCount = useIptvStore((s) => s.channels.length);

  return (
    <button
      onClick={() => navigate('/settings/iptv')}
      className="w-full flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-left transition-colors"
    >
      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
        <Tv2 size={20} className="text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-900 dark:text-white text-sm">
          Mon abonnement IPTV
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {channelsCount > 0
            ? `${channelsCount} chaînes importées · regarder en un clic`
            : 'Configurer pour regarder les matches directement'}
        </div>
      </div>
      <ChevronRight size={18} className="text-slate-400 shrink-0" />
    </button>
  );
}
