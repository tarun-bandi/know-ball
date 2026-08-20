import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ExternalLink, Play } from 'lucide-react-native';
import { stadiumSlate } from '@/lib/theme';
import type { GameStatsHighlight } from '@/types/gameStats';

interface GameHighlightsProps {
  highlights: GameStatsHighlight[];
  isDesktop: boolean;
}

function durationLabel(duration: number | null): string | null {
  if (!duration || duration <= 0) return null;
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function GameHighlights({ highlights, isDesktop }: GameHighlightsProps) {
  const [selectedId, setSelectedId] = useState(highlights[0]?.id ?? '');
  const selected = useMemo(
    () => highlights.find((highlight) => highlight.id === selectedId) ?? highlights[0],
    [highlights, selectedId],
  );
  const initialUrl = highlights[0]?.videoUrl ?? null;
  const loadedUrl = useRef(initialUrl);
  const player = useVideoPlayer(initialUrl, (instance) => {
    instance.loop = false;
  });

  useEffect(() => {
    if (!selected?.videoUrl || loadedUrl.current === selected.videoUrl) return;
    loadedUrl.current = selected.videoUrl;
    player.pause();
    void player.replaceAsync({
      uri: selected.videoUrl,
      useCaching: true,
      metadata: { title: selected.title },
    });
  }, [player, selected]);

  if (!selected) return null;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 18,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.09)',
        backgroundColor: stadiumSlate.surface,
      }}
    >
      <View style={{ paddingHorizontal: isDesktop ? 22 : 16, paddingTop: 18, paddingBottom: 14 }}>
        <Text style={{ color: stadiumSlate.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 }}>
          GAME VIDEO
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginTop: 5 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: stadiumSlate.text, fontSize: isDesktop ? 19 : 16, fontWeight: '900', letterSpacing: -0.3 }}>
              Highlights & reactions
            </Text>
            <Text numberOfLines={2} style={{ color: stadiumSlate.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
              {selected.title}
            </Text>
          </View>
          {selected.externalUrl ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(selected.externalUrl!)}
              accessibilityRole="link"
              accessibilityLabel="Open this video on ESPN"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' }}
            >
              <Text style={{ color: stadiumSlate.textMuted, fontSize: 11, fontWeight: '800' }}>ESPN</Text>
              <ExternalLink size={13} color={stadiumSlate.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={{ backgroundColor: '#05080d', aspectRatio: 16 / 9, width: '100%' }}>
        <VideoView
          player={player}
          nativeControls
          playsInline
          contentFit="contain"
          fullscreenOptions={{ enable: true, orientation: 'landscape' }}
          style={{ width: '100%', height: '100%' }}
        />
      </View>

      {highlights.length > 1 ? (
        <View style={{ paddingVertical: 14 }}>
          <Text style={{ color: stadiumSlate.textSubtle, fontSize: 9, fontWeight: '900', letterSpacing: 1.4, paddingHorizontal: 16, marginBottom: 10 }}>
            MORE FROM THIS GAME
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {highlights.map((highlight) => {
              const active = highlight.id === selected.id;
              const duration = durationLabel(highlight.duration);
              return (
                <TouchableOpacity
                  key={highlight.id}
                  onPress={() => setSelectedId(highlight.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Play ${highlight.title}`}
                  activeOpacity={0.78}
                  style={{
                    width: isDesktop ? 250 : 210,
                    flexDirection: 'row',
                    gap: 10,
                    padding: 8,
                    borderRadius: 13,
                    borderWidth: 1,
                    borderColor: active ? 'rgba(255,112,72,0.72)' : 'rgba(255,255,255,0.08)',
                    backgroundColor: active ? 'rgba(255,112,72,0.11)' : stadiumSlate.surfaceElevated,
                  }}
                >
                  <View style={{ width: 76, height: 48, borderRadius: 9, overflow: 'hidden', backgroundColor: '#080c12', alignItems: 'center', justifyContent: 'center' }}>
                    {highlight.thumbnailUrl ? (
                      <Image source={{ uri: highlight.thumbnailUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : null}
                    <View style={{ position: 'absolute', width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,8,13,0.76)' }}>
                      <Play size={12} fill={stadiumSlate.text} color={stadiumSlate.text} />
                    </View>
                    {duration ? (
                      <Text style={{ position: 'absolute', right: 3, bottom: 2, color: '#fff', fontSize: 8, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3 }}>
                        {duration}
                      </Text>
                    ) : null}
                  </View>
                  <Text numberOfLines={3} style={{ flex: 1, color: active ? stadiumSlate.text : stadiumSlate.textMuted, fontSize: 11, lineHeight: 15, fontWeight: '700' }}>
                    {highlight.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
