import { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, ExternalLink, Copy } from 'lucide-react';
import { IptvChannel } from '../types/iptv';

interface VideoPlayerProps {
  channel: IptvChannel;
  onClose: () => void;
}

type PlaybackMode = 'proxy' | 'direct';

/**
 * Lecteur vidéo IPTV intégré.
 *
 * ⚠️ STRATÉGIE DE LECTURE PROXY-FIRST
 *   Les serveurs IPTV ne supportent quasi jamais CORS. La lecture directe
 *   depuis le navigateur échoue donc dans 90% des cas. On démarre donc
 *   AUTOMATIQUEMENT en mode proxy (via Netlify Function).
 *
 * 🔋 LAZY-LOADING de hls.js
 *   La lib HLS fait ~500 KB. Pour ne pas alourdir le chargement initial
 *   de l'app (qui causait un écran blanc sur certains navigateurs), on
 *   la charge uniquement quand le composant est monté.
 *
 * ⚠️ CONSOMMATION BANDE PASSANTE NETLIFY
 *   Le mode proxy consomme la bande passante du compte Netlify (100 Go/mois
 *   en gratuit). Un match HD d'1h30 = ~2-3 Go.
 */
export function VideoPlayer({ channel, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  // Par défaut : proxy (mode B recommandé par l'utilisateur)
  const [mode, setMode] = useState<PlaybackMode>('proxy');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);

    // URL selon le mode
    const streamUrl =
      mode === 'proxy'
        ? `/.netlify/functions/iptv-proxy?url=${encodeURIComponent(channel.streamUrl)}&mode=stream`
        : channel.streamUrl;

    // Cleanup HLS précédent
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let cancelled = false;

    // Tentative de lecture HLS via hls.js (lazy-loaded)
    const startHls = async () => {
      try {
        // Import dynamique : hls.js est chargé seulement ici
        const { default: Hls } = await import('hls.js');
        if (cancelled) return;

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 30,
            // Plus tolérant aux erreurs réseau sur IPTV
            fragLoadingMaxRetry: 6,
            manifestLoadingMaxRetry: 4,
            levelLoadingMaxRetry: 4,
          });
          hlsRef.current = hls;

          hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
            if (!data.fatal) return;
            console.warn('[Player] HLS fatal error', data);
            if (mode === 'direct') {
              // Bascule auto vers proxy
              setMode('proxy');
            } else {
              setError(
                `Lecture impossible. Essayez VLC ou copiez l'URL.\n\nDétails : ${data.details ?? data.type}`
              );
              setLoading(false);
            }
          });

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setLoading(false);
            video.play().catch(() => {
              // Autoplay bloqué, l'utilisateur cliquera sur play
            });
          });

          hls.loadSource(streamUrl);
          hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari / iOS : HLS natif
          video.src = streamUrl;
          video.addEventListener(
            'loadedmetadata',
            () => {
              setLoading(false);
              video.play().catch(() => {});
            },
            { once: true }
          );
          video.addEventListener(
            'error',
            () => {
              setError("Le flux n'a pas pu être lu. Essayez VLC ou copiez l'URL.");
              setLoading(false);
            },
            { once: true }
          );
        } else {
          setError("Ce navigateur ne supporte pas la lecture HLS. Utilisez VLC.");
          setLoading(false);
        }
      } catch (e: any) {
        setError(`Erreur chargement lecteur : ${e?.message ?? e}`);
        setLoading(false);
      }
    };

    startHls();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [channel.streamUrl, mode]);

  const handleOpenVlc = () => {
    const vlcUrl = `vlc://${channel.streamUrl}`;
    window.location.href = vlcUrl;
    navigator.clipboard?.writeText(channel.streamUrl).catch(() => {});
  };

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(channel.streamUrl).then(
        () => alert('URL copiée dans le presse-papier'),
        () => prompt("Copiez cette URL :", channel.streamUrl)
      );
    } else {
      prompt("Copiez cette URL :", channel.streamUrl);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Barre du haut */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/90 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="text-white font-semibold text-sm truncate">{channel.name}</div>
          <div className="text-[10px] text-white/60">
            {mode === 'proxy' ? 'Via proxy Netlify' : 'Lecture directe'}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20"
        >
          <X size={20} className="text-white" />
        </button>
      </div>

      {/* Zone vidéo */}
      <div className="flex-1 flex items-center justify-center relative bg-black">
        <video
          ref={videoRef}
          className="max-w-full max-h-full w-full"
          controls
          playsInline
          autoPlay
        />

        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white pointer-events-none">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
              <div className="text-sm">Connexion au flux...</div>
              <div className="text-xs text-white/60 mt-1">via proxy Netlify</div>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 text-white p-6 overflow-y-auto">
            <div className="max-w-md text-center">
              <AlertCircle size={48} className="text-red-400 mx-auto mb-3" />
              <div className="text-sm mb-4 whitespace-pre-wrap">{error}</div>

              <div className="space-y-2">
                <button
                  onClick={handleOpenVlc}
                  className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <ExternalLink size={14} />
                  Ouvrir dans VLC
                </button>
                <button
                  onClick={handleCopy}
                  className="w-full py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm flex items-center justify-center gap-2"
                >
                  <Copy size={14} />
                  Copier l'URL
                </button>
                {mode === 'proxy' && (
                  <button
                    onClick={() => setMode('direct')}
                    className="w-full py-2 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs"
                  >
                    Essayer en lecture directe (CORS requis côté serveur)
                  </button>
                )}
              </div>

              <div className="text-[11px] text-white/60 mt-4 leading-relaxed">
                Si la lecture proxy échoue, votre serveur IPTV bloque peut-être
                le user-agent Netlify. VLC lit le flux sans aucune restriction.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barre du bas */}
      {!error && !loading && (
        <div className="px-4 py-2 bg-black/90 flex gap-3 justify-center">
          <button
            onClick={handleOpenVlc}
            className="text-xs text-orange-300 hover:text-orange-200 py-1 px-3 rounded flex items-center gap-1"
          >
            <ExternalLink size={11} /> VLC
          </button>
          <button
            onClick={handleCopy}
            className="text-xs text-white/70 hover:text-white py-1 px-3 rounded flex items-center gap-1"
          >
            <Copy size={11} /> URL
          </button>
        </div>
      )}
    </div>
  );
}
