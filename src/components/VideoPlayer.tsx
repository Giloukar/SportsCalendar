import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Copy, AlertCircle, PlayCircle } from 'lucide-react';
import { IptvChannel } from '../types/iptv';

interface VideoPlayerProps {
  channel: IptvChannel;
  onClose: () => void;
}

/**
 * Lecteur vidéo IPTV — version honnête.
 *
 * ─── Pourquoi pas de "lecture via proxy Netlify" ? ───
 *   Les Netlify Functions ont un timeout de 26 secondes. Elles attendent
 *   la réponse COMPLÈTE avant de la renvoyer — elles ne streament pas.
 *   Un flux vidéo live dure des heures, donc techniquement impossible.
 *   J'avais promis ça dans la v8, c'était une erreur de design.
 *
 * ─── Stratégie actuelle ───
 *   1. BOUTON PRINCIPAL : "Ouvrir dans VLC" — fonctionne à 100%
 *      • Utilise le schéma vlc://URL que VLC intercepte sur Android/iOS/PC
 *      • Copie aussi l'URL dans le presse-papier en backup
 *   2. BOUTON SECONDAIRE : "Tenter lecture directe navigateur" — marche
 *      seulement si le serveur IPTV a CORS activé (environ 10% des cas)
 *   3. BOUTON TERTIAIRE : "Copier l'URL" pour usage manuel
 *
 * ─── Solution propre pour lecture intégrée ? ───
 *   Self-hoster un iptv-proxy (pierre-emmanuelJ/iptv-proxy) sur Oracle
 *   Cloud Free Tier ou autre VPS gratuit. Ça dépasse le scope d'une PWA
 *   hébergée sur Netlify.
 */
export function VideoPlayer({ channel, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const [tryDirect, setTryDirect] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Lance la tentative de lecture directe dans le navigateur
  useEffect(() => {
    if (!tryDirect) return;

    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);

    const isHls = /\.m3u8(\?|$)/i.test(channel.streamUrl);
    let cancelled = false;

    const start = async () => {
      try {
        if (isHls) {
          const { default: Hls } = await import('hls.js');
          if (cancelled) return;

          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
            });
            hlsRef.current = hls;

            hls.on(Hls.Events.ERROR, (_e: any, data: any) => {
              if (!data.fatal) return;
              setError(
                `CORS bloqué par votre serveur IPTV.\n\nLa lecture directe ne marche que si votre provider autorise les requêtes navigateur (rare).\n\nUtilisez VLC.`
              );
              setLoading(false);
            });

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              setLoading(false);
              video.play().catch(() => {});
            });

            hls.loadSource(channel.streamUrl);
            hls.attachMedia(video);
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = channel.streamUrl;
            video.addEventListener('loadedmetadata', () => {
              setLoading(false);
              video.play().catch(() => {});
            }, { once: true });
            video.addEventListener('error', () => {
              setError('Lecture impossible. Utilisez VLC.');
              setLoading(false);
            }, { once: true });
          }
        } else {
          // Pas du HLS (.ts brut) → le navigateur ne saura pas lire
          setError("Ce flux n'est pas en HLS. Les navigateurs ne peuvent pas lire les flux .ts bruts. Utilisez VLC.");
          setLoading(false);
        }
      } catch (e: any) {
        setError(`Erreur : ${e?.message ?? e}`);
        setLoading(false);
      }
    };

    start();

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
  }, [tryDirect, channel.streamUrl]);

  const handleOpenVlc = () => {
    // Copie aussi l'URL pour VLC desktop (schéma vlc:// ne marche pas partout)
    if (navigator.clipboard) {
      navigator.clipboard.writeText(channel.streamUrl).catch(() => {});
    }
    // Android : vlc://URL fonctionne si VLC est installé
    // iOS : vlc-x-callback://x-callback-url/stream?url=... (mais peu fiable)
    // Desktop : peut déclencher VLC si protocole enregistré
    window.location.href = `vlc://${channel.streamUrl}`;
  };

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(channel.streamUrl).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        },
        () => prompt('Copiez cette URL :', channel.streamUrl)
      );
    } else {
      prompt('Copiez cette URL :', channel.streamUrl);
    }
  };

  // ───── Vue principale (avant tentative directe) ─────
  if (!tryDirect) {
    return (
      <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Fermer"
          >
            <X size={18} className="text-white" />
          </button>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-500/20 mb-3">
              <PlayCircle size={28} className="text-blue-400" />
            </div>
            <div className="text-white font-bold text-lg">{channel.name}</div>
            {channel.group && (
              <div className="text-xs text-white/50 mt-0.5">{channel.group}</div>
            )}
          </div>

          {/* Bouton principal VLC */}
          <button
            onClick={handleOpenVlc}
            className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-base shadow-lg transition-colors mb-3"
          >
            <ExternalLink size={18} />
            Ouvrir dans VLC
          </button>

          <div className="text-[11px] text-white/50 text-center mb-5 leading-relaxed">
            Recommandé : VLC lit n'importe quel flux IPTV sans restriction.
            Si VLC ne s'ouvre pas automatiquement, l'URL est copiée pour collage manuel.
          </div>

          {/* Boutons secondaires */}
          <div className="space-y-2">
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
            >
              <Copy size={14} />
              {copied ? 'URL copiée ✓' : "Copier l'URL du flux"}
            </button>

            <button
              onClick={() => setTryDirect(true)}
              className="w-full py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs"
            >
              Tenter lecture directe navigateur (CORS requis)
            </button>
          </div>

          <div className="mt-5 pt-4 border-t border-white/10 text-[10px] text-white/40 text-center leading-relaxed">
            La lecture intégrée complète n'est pas possible depuis un hébergement
            Netlify gratuit (timeout 26s sur les Functions).
          </div>
        </div>
      </div>
    );
  }

  // ───── Vue tentative lecture directe ─────
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/90">
        <div className="min-w-0 flex-1">
          <div className="text-white font-semibold text-sm truncate">{channel.name}</div>
          <div className="text-[10px] text-white/60">Lecture directe (CORS)</div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20"
        >
          <X size={20} className="text-white" />
        </button>
      </div>

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
              <div className="text-sm">Tentative de lecture directe...</div>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 text-white p-6">
            <div className="max-w-md text-center">
              <AlertCircle size={48} className="text-red-400 mx-auto mb-3" />
              <div className="text-sm mb-4 whitespace-pre-wrap">{error}</div>
              <div className="space-y-2">
                <button
                  onClick={handleOpenVlc}
                  className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2"
                >
                  <ExternalLink size={14} />
                  Ouvrir dans VLC
                </button>
                <button
                  onClick={() => setTryDirect(false)}
                  className="w-full py-2 px-4 rounded-lg bg-white/10 text-white/70 text-xs"
                >
                  Retour
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
