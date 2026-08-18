import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { MessageCircle, Send, Trash2, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/authStore';
import { useToastStore } from '@/lib/store/toastStore';
import Avatar from './Avatar';
import ResponsiveModalFrame from './ResponsiveModalFrame';
import { stadiumSlate } from '@/lib/theme';
import type { Comment, UserProfile } from '@/types/database';

interface CommentWithProfile extends Comment {
  profile?: UserProfile;
}

interface CommentsSheetProps {
  logId: string;
  onClose: () => void;
  onCommentCountChange?: (count: number) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function CommentsSheet({
  logId,
  onClose,
  onCommentCountChange,
}: CommentsSheetProps) {
  const { user } = useAuthStore();
  const toast = useToastStore();
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  async function fetchComments() {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('log_id', logId)
      .order('created_at', { ascending: true });

    if (error) {
      toast.show('Failed to load comments', 'error');
      setLoading(false);
      return;
    }

    const rawComments = (data ?? []) as Comment[];

    // Fetch profiles
    const userIds = [...new Set(rawComments.map((c) => c.user_id))];
    let profileMap: Record<string, UserProfile> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('*')
        .in('user_id', userIds);
      for (const p of (profiles ?? []) as UserProfile[]) {
        profileMap[p.user_id] = p;
      }
    }

    setComments(
      rawComments.map((c) => ({ ...c, profile: profileMap[c.user_id] })),
    );
    onCommentCountChange?.(rawComments.length);
    setLoading(false);
  }

  useEffect(() => {
    fetchComments();
  }, [logId]);

  async function handlePost() {
    if (!user || !body.trim()) return;
    setPosting(true);

    const { error } = await supabase.from('comments').insert({
      user_id: user.id,
      log_id: logId,
      body: body.trim(),
    });

    setPosting(false);

    if (error) {
      toast.show(error.message, 'error');
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setBody('');
      fetchComments();
    }
  }

  async function handleDelete(commentId: string) {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      toast.show(error.message, 'error');
    } else {
      fetchComments();
    }
  }

  const canPost = !!body.trim() && !posting;

  return (
    <ResponsiveModalFrame
      onClose={onClose}
      maxWidth={640}
      desktopMaxHeight={720}
      mobileMaxHeight="82%"
      keyboardAware
      testID="comments-dialog"
    >
      <View style={{ minHeight: 0, flexShrink: 1 }}>
        <View
          style={{
            paddingHorizontal: 22,
            paddingTop: 20,
            paddingBottom: 17,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.075)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,106,61,0.13)',
                borderWidth: 1,
                borderColor: 'rgba(255,106,61,0.2)',
              }}
            >
              <MessageCircle size={19} color={stadiumSlate.accent} strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: stadiumSlate.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.45 }}>
                Comments
              </Text>
              <Text style={{ color: stadiumSlate.textMuted, fontSize: 12, marginTop: 3 }}>
                {loading ? 'Loading the conversation…' : `${comments.length} ${comments.length === 1 ? 'reply' : 'replies'}`}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close comments"
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: stadiumSlate.background,
              borderWidth: 1,
              borderColor: stadiumSlate.border,
            }}
          >
            <X size={18} color={stadiumSlate.textMuted} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ minHeight: 220, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={stadiumSlate.accent} />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 410 }}
            contentContainerStyle={
              comments.length === 0
                ? { minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: 24 }
                : { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 8 }
            }
            ListEmptyComponent={
              <View style={{ alignItems: 'center', maxWidth: 300 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: stadiumSlate.surfaceRaised,
                    borderWidth: 1,
                    borderColor: stadiumSlate.border,
                    marginBottom: 13,
                  }}
                >
                  <MessageCircle size={20} color={stadiumSlate.textMuted} />
                </View>
                <Text style={{ color: stadiumSlate.text, fontSize: 15, fontWeight: '800' }}>Start the conversation</Text>
                <Text style={{ color: stadiumSlate.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 }}>
                  Drop the first reply about this game.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={{ flexDirection: 'row', gap: 11, marginBottom: 18 }}>
                <Avatar
                  url={item.profile?.avatar_url}
                  name={item.profile?.display_name ?? '?'}
                  size={34}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Text style={{ color: stadiumSlate.text, fontSize: 13, fontWeight: '800' }}>
                      {item.profile?.display_name ?? 'Unknown'}
                    </Text>
                    <Text style={{ color: stadiumSlate.textSubtle, fontSize: 11 }}>
                      {timeAgo(item.created_at)}
                    </Text>
                    {item.user_id === user?.id ? (
                      <TouchableOpacity
                        onPress={() => handleDelete(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Delete comment"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ marginLeft: 'auto' }}
                      >
                        <Trash2 size={13} color={stadiumSlate.danger} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text style={{ color: stadiumSlate.text, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
                    {item.body}
                  </Text>
                </View>
              </View>
            )}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
            paddingHorizontal: 18,
            paddingVertical: 16,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.075)',
            backgroundColor: stadiumSlate.surfaceElevated,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              minHeight: 48,
              maxHeight: 112,
              borderRadius: 15,
              borderWidth: 1,
              borderColor: stadiumSlate.border,
              backgroundColor: stadiumSlate.background,
              color: stadiumSlate.text,
              fontSize: 14,
              lineHeight: 20,
              paddingHorizontal: 15,
              paddingTop: 13,
              paddingBottom: 13,
              outlineStyle: 'none',
            } as any}
            placeholder="Add a comment…"
            placeholderTextColor={stadiumSlate.textSubtle}
            value={body}
            onChangeText={setBody}
            onSubmitEditing={handlePost}
            maxLength={500}
            multiline
            accessibilityLabel="Comment text"
          />
          <TouchableOpacity
            onPress={handlePost}
            disabled={!canPost}
            accessibilityRole="button"
            accessibilityLabel="Post comment"
            style={{
              width: 48,
              height: 48,
              borderRadius: 15,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canPost ? stadiumSlate.accent : stadiumSlate.surfaceRaised,
              borderWidth: 1,
              borderColor: canPost ? stadiumSlate.accent : stadiumSlate.border,
              opacity: posting ? 0.7 : 1,
            }}
          >
            {posting ? (
              <ActivityIndicator color={stadiumSlate.background} size="small" />
            ) : (
              <Send size={18} color={canPost ? stadiumSlate.background : stadiumSlate.textSubtle} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ResponsiveModalFrame>
  );
}
