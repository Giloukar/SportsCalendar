import { useState } from 'react';
import {
  Tv2, Upload, Download, Trash2, AlertCircle, CheckCircle2, Eye, EyeOff,
  Search, Link2, Server,
} from 'lucide-react';
import { useIptvStore } from '@store/iptvStore';
import { importChannels } from '@services/iptvImportService';
import { IptvSourceType } from '../types/iptv';

/**
 * Écran de configuration IPTV.
 *
 * Permet à l'utilisateur de :
 *  - Importer sa playlist (M3U ou Xtream Codes)
 *  - Voir la liste des chaînes importées
 *  - Masquer certaines chaînes
 *  - Gérer les correspondances manuelles
 *  - Supprimer toutes les données
 */
export function IptvSettingsScreen() {
  const { source, channels, mappings, isImporting, lastImportError } = useIptvStore();
  const setSource = useIptvStore((s) => s.setSource);
  const setChannels = useIptvStore((s) => s.setChannels);
  const setImporting = useIptvStore((s) => s.setImporting);
  const setImportError = useIptvStore((s) => s.setImportError);
  const toggleChannelHidden = useIptvStore((s) => s.toggleChannelHidden);
  const removeMapping = useIptvStore((s) => s.removeMapping);
  const clearAll = useIptvStore((s) => s.clearAll);

  const [sourceType, setSourceType] = useState<IptvSourceType>(source?.type ?? 'xtream');
  const [m3uUrl, setM3uUrl] = useState(source?.m3uUrl ?? '');
  const [xtreamServer, setXtreamServer] = useState(source?.xtreamServer ?? '');
  const [xtreamUsername, setXtreamUsername] = useState(source?.xtreamUsername ?? '');
  const [xtreamPassword, setXtreamPassword] = useState(source?.xtreamPassword ?? '');
  const [showPassword, setShowPassword] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleImport = async () => {
    const config = {
      type: sourceType,
      m3uUrl: sourceType === 'm3u' ? m3uUrl.trim() : undefined,
      xtreamServer: sourceType === 'xtream' ? xtreamServer.trim() : undefined,
      xtreamUsername: sourceType === 'xtream' ? xtreamUsername.trim() : undefined,
      xtreamPassword: sourceType === 'xtream' ? xtreamPassword : undefined,
    };

    setImporting(true);
    setImportError(null);

    try {
      const imported = await importChannels(config);
      if (imported.length === 0) {
        throw new Error('Aucune chaîne trouvée dans la playlist');
      }
      setChannels(imported);
      setSource({ ...config, lastImportedAt: new Date().toISOString() });
      showFeedback('success', `${imported.length} chaînes importées avec succès`);
    } catch (error: any) {
      const msg = error?.message ?? String(error);
      setImportError(msg);
      showFeedback('error', msg);
    } finally {
      setImporting(false);
    }
  };

  const handleClearAll = () => {
    if (
      confirm(
        'Supprimer toutes les données IPTV (configuration, chaînes, correspondances) ?\nCette action est irréversible.'
      )
    ) {
      clearAll();
      setM3uUrl('');
      setXtreamServer('');
      setXtreamUsername('');
      setXtreamPassword('');
      showFeedback('success', 'Données IPTV supprimées');
    }
  };

  const filteredChannels = channels.filter((c) =>
    !channelSearch ||
    c.name.toLowerCase().includes(channelSearch.toLowerCase()) ||
    c.group?.toLowerCase().includes(channelSearch.toLowerCase())
  );

  return (
    <div className="pb-8">
      <div className="px-4 pt-6 md:pt-10 pb-4">
        <div className="flex items-center gap-2.5">
          <Tv2 size={28} className="text-blue-600" />
          <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white">
            IPTV
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Connectez votre abonnement pour regarder directement dans SportCal.
        </p>
      </div>

      {feedback && (
        <div
          className={`mx-4 mb-4 px-4 py-3 rounded-lg text-sm font-semibold flex items-start gap-2 ${
            feedback.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Avertissement sécurité */}
      <div className="mx-4 mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200">
        <div className="font-bold mb-1">🔒 Vos identifiants restent sur votre appareil</div>
        <p>
          Vos données IPTV ne sont jamais envoyées à un serveur SportCal.
          Elles sont stockées uniquement en local et peuvent être supprimées à tout moment.
        </p>
      </div>

      {/* Configuration source */}
      <div className="px-4 mb-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
          Source IPTV
        </h2>

        {/* Toggle M3U / Xtream */}
        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 mb-3">
          <button
            onClick={() => setSourceType('xtream')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
              sourceType === 'xtream'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Server size={14} />
            Xtream Codes
          </button>
          <button
            onClick={() => setSourceType('m3u')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
              sourceType === 'm3u'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Link2 size={14} />
            URL M3U
          </button>
        </div>

        {sourceType === 'xtream' ? (
          <div className="space-y-2">
            <Input
              label="Serveur (ex: http://monserveur.com:8080)"
              value={xtreamServer}
              onChange={setXtreamServer}
              placeholder="http://..."
            />
            <Input
              label="Nom d'utilisateur"
              value={xtreamUsername}
              onChange={setXtreamUsername}
            />
            <div className="relative">
              <Input
                label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                value={xtreamPassword}
                onChange={setXtreamPassword}
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-7 p-1.5 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        ) : (
          <Input
            label="URL de la playlist M3U"
            value={m3uUrl}
            onChange={setM3uUrl}
            placeholder="http://.../get.php?..."
          />
        )}

        <button
          onClick={handleImport}
          disabled={isImporting}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm transition-colors"
        >
          {isImporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Import en cours...
            </>
          ) : (
            <>
              <Download size={16} />
              {channels.length > 0 ? 'Réimporter les chaînes' : 'Importer les chaînes'}
            </>
          )}
        </button>

        {source?.lastImportedAt && (
          <p className="text-xs text-slate-500 mt-2 text-center">
            Dernier import : {new Date(source.lastImportedAt).toLocaleString('fr-FR')}
          </p>
        )}

        {lastImportError && (
          <div className="mt-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-xs text-red-800 dark:text-red-300">
            {lastImportError}
          </div>
        )}
      </div>

      {/* Liste des chaînes */}
      {channels.length > 0 && (
        <div className="px-4 mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Chaînes importées
            </h2>
            <span className="text-xs text-slate-500">
              {channels.length} chaîne{channels.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="relative mb-3">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              placeholder="Rechercher une chaîne..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 max-h-96 overflow-y-auto">
            {filteredChannels.slice(0, 100).map((channel) => (
              <div
                key={channel.id}
                className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-semibold truncate ${
                      channel.hidden
                        ? 'text-slate-400 line-through'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {channel.name}
                  </div>
                  {channel.group && (
                    <div className="text-[11px] text-slate-500 truncate">
                      {channel.group}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggleChannelHidden(channel.id)}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                  title={channel.hidden ? 'Afficher' : 'Masquer'}
                >
                  {channel.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            ))}
            {filteredChannels.length > 100 && (
              <div className="px-3 py-2 text-center text-xs text-slate-500">
                …et {filteredChannels.length - 100} autres chaînes. Affinez votre recherche.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Correspondances manuelles */}
      {mappings.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            Correspondances manuelles
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Diffuseurs pour lesquels vous avez choisi une chaîne spécifique.
          </p>
          <div className="space-y-1.5">
            {mappings.map((m) => {
              const channel = channels.find((c) => c.id === m.iptvChannelId);
              return (
                <div
                  key={m.broadcastName}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {m.broadcastName}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      → {channel?.name ?? `Chaîne supprimée (${m.iptvChannelId})`}
                    </div>
                  </div>
                  <button
                    onClick={() => removeMapping(m.broadcastName)}
                    className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Danger zone */}
      {channels.length > 0 && (
        <div className="px-4">
          <button
            onClick={handleClearAll}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-white dark:bg-slate-800 border-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold text-sm"
          >
            <Trash2 size={14} />
            Supprimer toutes les données IPTV
          </button>
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400"
      />
    </div>
  );
}
