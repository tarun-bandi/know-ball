import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import {
  X,
  ImagePlus,
  XCircle,
  Radio,
  RotateCcw,
  FastForward,
  Sparkles,
  NotebookPen,
  Trash2,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/authStore';
import { useToastStore } from '@/lib/store/toastStore';
import { removeGameRanking } from '@/lib/rankingService';
import { pickLogImages, uploadLogImage, deleteLogImage, MAX_IMAGES } from '@/lib/uploadLogImages';
import * as Haptics from 'expo-haptics';
import type { GameLog, WatchMode, LogTag } from '@/types/database';

export interface LogModalResult {
  showRankingFlow?: boolean;
  gameId?: string;
}

interface LogModalProps {
  gameId: string;
  existingLog: (GameLog & { tags?: LogTag[] }) | null;
  onClose: () => void;
  onSuccess: (result?: LogModalResult) => void;
}

const WATCH_MODES: { value: WatchMode; label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: 'replay', label: 'Replay' },
  { value: 'condensed', label: 'Condensed' },
  { value: 'highlights', label: 'Highlights' },
];

const WATCH_MODE_ICONS = {
  live: Radio,
  replay: RotateCcw,
  condensed: FastForward,
  highlights: Sparkles,
};

export default function LogModal({
  gameId,
  existingLog,
  onClose,
  onSuccess,
}: LogModalProps) {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const { width, height } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;
  const [watchMode, setWatchMode] = useState<WatchMode | null>(
    existingLog?.watch_mode ?? null
  );
  const [review, setReview] = useState(existingLog?.review ?? '');
  const [hasSpoilers, setHasSpoilers] = useState(
    existingLog?.has_spoilers ?? false
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Images
  const [imageUrls, setImageUrls] = useState<string[]>(
    existingLog?.image_urls ?? []
  );
  const [uploading, setUploading] = useState(false);

  // Tags
  const [availableTags, setAvailableTags] = useState<LogTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set((existingLog?.tags ?? []).map((t) => t.id))
  );

  useEffect(() => {
    supabase
      .from('log_tags')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setAvailableTags(data as LogTag[]);
      });
  }, []);

  function toggleTag(tagId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  async function handlePickImages() {
    if (!user) return;
    const remaining = MAX_IMAGES - imageUrls.length;
    if (remaining <= 0) return;

    const assets = await pickLogImages(remaining);
    if (!assets) return;

    setUploading(true);
    try {
      const urls: string[] = [];
      for (const asset of assets) {
        const url = await uploadLogImage(user.id, asset.uri, asset.mimeType);
        urls.push(url);
      }
      setImageUrls((prev) => [...prev, ...urls]);
    } catch (err: any) {
      toast.show(err.message ?? 'Failed to upload image', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveImage(url: string) {
    try {
      await deleteLogImage(url);
    } catch {} // best-effort cleanup
    setImageUrls((prev) => prev.filter((u) => u !== url));
  }

  async function performDelete() {
    if (!existingLog || !user) return;
    setDeleting(true);
    const { error } = await supabase
      .from('game_logs')
      .delete()
      .eq('id', existingLog.id);
    if (!error) {
      // Also remove ranking if it exists
      try {
        await removeGameRanking(user.id, gameId);
      } catch {}
      // Clean up images from storage
      for (const url of imageUrls) {
        try { await deleteLogImage(url); } catch {}
      }
    }
    setDeleting(false);
    if (error) {
      toast.show(error.message, 'error');
    } else {
      toast.show('Log deleted');
      onSuccess();
    }
  }

  function handleDelete() {
    if (!existingLog) return;
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this log? This cannot be undone.')) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Log',
        'Are you sure you want to delete this log? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ],
      );
    }
  }

  async function handleSave() {
    if (!user) return;

    setSaving(true);

    // Upsert the game log
    const { data: logData, error } = await supabase
      .from('game_logs')
      .upsert(
        {
          user_id: user.id,
          game_id: gameId,
          watch_mode: watchMode,
          review: review.trim() || null,
          has_spoilers: hasSpoilers,
          image_urls: imageUrls.length > 0 ? imageUrls : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,game_id' }
      )
      .select('id')
      .single();

    if (error || !logData) {
      setSaving(false);
      toast.show(error?.message ?? 'Failed to save log', 'error');
      return;
    }

    // Update tags: delete existing, insert selected
    const logId = logData.id;
    await supabase.from('game_log_tag_map').delete().eq('log_id', logId);

    if (selectedTagIds.size > 0) {
      const tagRows = [...selectedTagIds].map((tag_id) => ({
        log_id: logId,
        tag_id,
      }));
      await supabase.from('game_log_tag_map').insert(tagRows);
    }

    setSaving(false);
    toast.show(existingLog ? 'Log updated' : 'Game logged!');
    onSuccess(
      !existingLog
        ? { showRankingFlow: true, gameId }
        : undefined
    );
  }

  return (
    <Modal
      visible
      transparent
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        className={`flex-1 bg-black/75 ${isDesktop ? 'items-center justify-center p-6' : 'justify-end'}`}
        onPress={onClose}
        style={Platform.OS === 'web' ? ({ backdropFilter: 'blur(8px)' } as any) : undefined}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: '100%', maxWidth: isDesktop ? 680 : undefined }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className={`overflow-hidden border-border bg-surface ${
              isDesktop ? 'rounded-3xl border' : 'rounded-t-3xl border-t'
            }`}
            style={{
              maxHeight: isDesktop ? Math.min(height - 48, 820) : height * 0.92,
              ...(isDesktop && Platform.OS === 'web'
                ? ({ boxShadow: '0 30px 90px rgba(0, 0, 0, 0.55)' } as any)
                : null),
            }}
          >
            {!isDesktop && (
              <View className="items-center pt-3 pb-1">
                <View className="h-1 w-10 rounded-full bg-border" />
              </View>
            )}

            {/* Header */}
            <View className={`flex-row items-center justify-between border-b border-border ${isDesktop ? 'px-6 py-5' : 'px-5 pt-2 pb-4'}`}>
              <View className="flex-1 flex-row items-center gap-3">
                {isDesktop && (
                  <View className="h-11 w-11 items-center justify-center rounded-2xl bg-accent/15">
                    <NotebookPen size={21} color="#ff7048" />
                  </View>
                )}
                <View className="flex-1">
                  {isDesktop && (
                    <Text className="mb-1 text-[10px] font-bold uppercase tracking-widest text-accent">
                      Game log
                    </Text>
                  )}
                  <Text className={`${isDesktop ? 'text-xl' : 'text-lg'} font-bold text-white`}>
                    {existingLog ? 'Edit your diary entry' : 'Add to your diary'}
                  </Text>
                  {isDesktop && (
                    <Text className="mt-1 text-xs text-muted">
                      Save how you watched and what you thought.
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                className="ml-4 h-10 w-10 items-center justify-center rounded-full border border-border bg-background"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Close game log"
              >
                <X size={19} color="#aeb9c8" />
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ flexShrink: 1 }}
              contentContainerStyle={{
                paddingHorizontal: isDesktop ? 24 : 20,
                paddingTop: 22,
                paddingBottom: 18,
              }}
            >
              {/* Watch Mode */}
              <View className="mb-6">
                <Text className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted">
                  How did you watch?
                </Text>
                <Text className="mb-3 text-xs text-muted">Choose one, or leave it blank.</Text>
                <View className="flex-row flex-wrap gap-2.5">
                  {WATCH_MODES.map(({ value, label }) => {
                    const WatchIcon = WATCH_MODE_ICONS[value];
                    const selected = watchMode === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        className={`flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3 ${
                          selected
                            ? 'border-accent bg-accent'
                            : 'border-border bg-background'
                        }`}
                        style={isDesktop ? { flex: 1 } : { width: '48%' }}
                        onPress={() =>
                          setWatchMode((prev) => (prev === value ? null : value))
                        }
                        activeOpacity={0.75}
                      >
                        <WatchIcon size={16} color={selected ? '#0b1017' : '#aeb9c8'} />
                        <Text className={`text-sm font-semibold ${selected ? 'text-background' : 'text-muted'}`}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Tags */}
              {availableTags.length > 0 && (
                <View className="mb-6">
                  <Text className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted">Tags</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {availableTags.map((tag) => {
                      const selected = selectedTagIds.has(tag.id);
                      return (
                        <TouchableOpacity
                          key={tag.id}
                          className={`rounded-lg border px-3 py-2 ${
                            selected
                              ? 'bg-accent/20 border-accent'
                              : 'bg-background border-border'
                          }`}
                          onPress={() => toggleTag(tag.id)}
                        >
                          <Text
                            className={`text-xs font-medium ${
                              selected ? 'text-accent' : 'text-muted'
                            }`}
                          >
                            {tag.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Review */}
              <View className="mb-6">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-[10px] font-bold uppercase tracking-widest text-muted">
                    Your take
                  </Text>
                  <Text className="text-[10px] font-medium text-muted">{review.length}/1000</Text>
                </View>
                <TextInput
                  className="rounded-2xl border border-border bg-background px-4 py-3.5 text-sm text-white"
                  placeholder="What stood out? Drop your take..."
                  placeholderTextColor="#8fa1b3"
                  value={review}
                  onChangeText={setReview}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  style={{
                    minHeight: 112,
                    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
                  }}
                  maxLength={1000}
                />
              </View>

              {/* Photos */}
              <View className="mb-6">
                <Text className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted">Photos</Text>
                {imageUrls.length === 0 ? (
                  <TouchableOpacity
                    className="flex-row items-center rounded-2xl border border-dashed border-border bg-background p-3.5"
                    onPress={handlePickImages}
                    disabled={uploading}
                    activeOpacity={0.75}
                  >
                    <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-surface-elevated">
                      {uploading ? (
                        <ActivityIndicator color="#ff7048" size="small" />
                      ) : (
                        <ImagePlus size={20} color="#ff7048" />
                      )}
                    </View>
                    <View>
                      <Text className="text-sm font-semibold text-white">Add photos</Text>
                      <Text className="mt-0.5 text-xs text-muted">Up to {MAX_IMAGES} images</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10, paddingTop: 6 }}
                  >
                    {imageUrls.map((url) => (
                      <View key={url} style={{ position: 'relative' }}>
                        <Image
                          source={{ uri: url }}
                          style={{ width: 74, height: 74, borderRadius: 14 }}
                          contentFit="cover"
                        />
                        <TouchableOpacity
                          style={{ position: 'absolute', top: -6, right: -6 }}
                          onPress={() => handleRemoveImage(url)}
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        >
                          <XCircle size={20} color="#ff6b76" fill="#0b1118" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {imageUrls.length < MAX_IMAGES && (
                      <TouchableOpacity
                        className="items-center justify-center rounded-2xl border border-dashed border-border bg-background"
                        style={{ width: 74, height: 74 }}
                        onPress={handlePickImages}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <ActivityIndicator color="#ff7048" size="small" />
                        ) : (
                          <ImagePlus size={21} color="#ff7048" />
                        )}
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                )}
              </View>

              {/* Spoiler toggle */}
              <View className="flex-row items-center justify-between rounded-2xl border border-border bg-surface-elevated p-4">
                <View className="mr-4 flex-1">
                  <Text className="text-sm font-semibold text-white">
                    Contains spoilers
                  </Text>
                  <Text className="mt-1 text-xs leading-4 text-muted">
                    Hide your review behind a spoiler warning.
                  </Text>
                </View>
                <Switch
                  value={hasSpoilers}
                  onValueChange={setHasSpoilers}
                  trackColor={{ false: '#2f4052', true: '#ff7048' }}
                  thumbColor="#ffffff"
                />
              </View>
            </ScrollView>

            {/* Fixed action footer */}
            <View className={`border-t border-border bg-surface px-5 py-4 ${isDesktop ? 'flex-row items-center justify-between' : ''}`}>
              {isDesktop && existingLog && (
                <TouchableOpacity
                  className="flex-row items-center gap-2 rounded-xl px-3 py-3"
                  onPress={handleDelete}
                  disabled={saving || deleting}
                >
                  {deleting ? (
                    <ActivityIndicator color="#ff6b76" size="small" />
                  ) : (
                    <Trash2 size={16} color="#ff6b76" />
                  )}
                  <Text className="text-sm font-semibold text-[#ff6b76]">Delete</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                className={`items-center rounded-xl bg-accent py-3.5 ${
                  isDesktop ? 'px-8' : 'w-full'
                } ${(saving || deleting || uploading) ? 'opacity-50' : ''}`}
                style={isDesktop ? { minWidth: 220, marginLeft: 'auto' } : undefined}
                onPress={handleSave}
                disabled={saving || deleting || uploading}
              >
                {saving ? (
                  <ActivityIndicator color="#0b1118" />
                ) : (
                  <Text className="text-base font-bold text-background">
                    {existingLog ? 'Update log' : 'Save log'}
                  </Text>
                )}
              </TouchableOpacity>

              {!isDesktop && existingLog && (
                <TouchableOpacity
                  className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-[#ff6b76] py-3.5"
                  onPress={handleDelete}
                  disabled={saving || deleting}
                >
                  {deleting ? (
                    <ActivityIndicator color="#ff6b76" size="small" />
                  ) : (
                    <Trash2 size={16} color="#ff6b76" />
                  )}
                  <Text className="text-sm font-semibold text-[#ff6b76]">Delete log</Text>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
