import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Animated, FlatList, Image, RefreshControl, View, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Button, Text, IconButton, Menu, Modal, Portal, TextInput, HelperText, Divider, Chip, Avatar } from 'react-native-paper';
import { fetchHubPosts, fetchHubPolls, createHubComment, deleteHubComment, fetchHubComments, reactToHubComment, removeHubCommentReaction, voteHubPoll, updateHubComment, updateHubPoll, deleteHubPoll } from './api';
import type { HubPost, HubPoll, HubReactionType } from './types';
import { PostCard } from './PostCard';
import { PostComposer } from './PostComposer';
import { PollComposer } from './PollComposer';

type ScopeBase =
  | { type: 'pharmacy'; id: number }
  | { type: 'organization'; id: number }
  | { type: 'group'; id: number }
  | { type: 'orgGroup'; id: number };

type Scope = ScopeBase | null;

type Props = {
  scope: Scope;
  onBack?: () => void;
  header?: {
    title: string;
    subtitle?: string;
    cover?: string | null;
    canEditProfile?: boolean;
    onEditProfile?: () => void;
  };
};

const HUB_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const HUB_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const formatDate = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const datePart = HUB_DATE_FORMATTER.format(parsed);
  const timePart = HUB_TIME_FORMATTER.format(parsed).replace('AM', 'am').replace('PM', 'pm');
  return `${datePart} ${timePart}`;
};

const formatMemberLabel = (name: string, role?: string | null, jobTitle?: string | null, fallback = 'Member') => {
  const display = name?.trim() || fallback;
  const parts = [display];
  if (role && role.trim()) parts.push(role.trim());
  if (jobTitle && jobTitle.trim()) parts.push(jobTitle.trim());
  return parts.join(' | ');
};

export function HubFeed({ scope, onBack, header }: Props) {
  const stableScope = React.useMemo(() => {
    if (!scope || scope.id == null) return null;
    const idNum = typeof scope.id === 'string' ? Number(scope.id) : scope.id;
    if (!Number.isFinite(idNum)) return null;
    const normalizedType = scope.type === 'orgGroup' ? 'group' : (scope as ScopeBase).type;
    return { type: normalizedType as ScopeBase['type'], id: idNum };
  }, [scope]);

  const scopeValid = Boolean(stableScope);

  const HEADER_EXPANDED = 220;
  const HEADER_COLLAPSED = 72;
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_EXPANDED - HEADER_COLLAPSED],
    outputRange: [HEADER_EXPANDED, HEADER_COLLAPSED],
    extrapolate: 'clamp',
  });
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_EXPANDED - HEADER_COLLAPSED],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const barOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_EXPANDED - HEADER_COLLAPSED],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const [posts, setPosts] = useState<HubPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [next, setNext] = useState<string | null>(null);
  const [composerVisible, setComposerVisible] = useState(false);
  const [pollVisible, setPollVisible] = useState(false);
  const [editing, setEditing] = useState<HubPost | null>(null);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [commentPost, setCommentPost] = useState<HubPost | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [commentReactionMenu, setCommentReactionMenu] = useState<number | null>(null);
  const [polls, setPolls] = useState<HubPoll[]>([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [pollsError, setPollsError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [editingPoll, setEditingPoll] = useState<HubPoll | null>(null);
  const [pollMenuId, setPollMenuId] = useState<number | null>(null);
  const reactionEmojis: Record<string, string> = {
    LIKE: '\uD83D\uDC4D',
    LOVE: '\u2764\uFE0F',
    CELEBRATE: '\uD83C\uDF89',
    SUPPORT: '\uD83D\uDE4C',
    INSIGHTFUL: '\uD83D\uDCA1',
  };

  const buildCommentTree = (list: any[]) => {
    if (!list?.length) return [];
    const nodes = list.map((c) => ({ ...c, replies: [] as any[] }));
    const lookup = new Map<number, any>();
    nodes.forEach((n) => lookup.set(n.id, n));
    const roots: any[] = [];
    nodes.forEach((n) => {
      const parentId = n.parent_comment || n.parentCommentId;
      if (parentId && lookup.has(parentId)) {
        lookup.get(parentId).replies.push(n);
      } else {
        roots.push(n);
      }
    });
    return roots;
  };

  const renderCommentNode = (c: any, depth: number) => {
    const created = c.created_at || c.createdAt;
    const author = c.author || {};
    const user = author.user_details || author.user || {};
    const role = author.role || null;
    const jobTitle = author.job_title || author.jobTitle || null;
    const baseName =
      `${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim() ||
      user.fullName ||
      user.email ||
      author.display_name ||
      author.displayName ||
      '';
    const displayName = formatMemberLabel(baseName, role, jobTitle, 'Member');
    const initials = displayName ? (displayName.trim().charAt(0) || 'M').toUpperCase() : 'M';
    const viewerReaction = c.viewer_reaction || c.viewerReaction;
    const summary = c.reaction_summary || c.reactionSummary || {};
    const isReplyingHere = replyToId === c.id && !editingCommentId;
    const commentPostId = c.post || c.postId || commentPost?.id;
    return (
      <View
        key={c.id}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          backgroundColor: '#FFFFFF',
          marginTop: depth ? 6 : 10,
          marginLeft: depth ? 12 : 0,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar.Text size={28} label={initials} style={{ backgroundColor: '#4B5563' }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: '#111827' }}>{displayName}</Text>
            {created ? <Text style={{ color: '#6B7280', fontSize: 12 }}>{formatDate(created)}</Text> : null}
          </View>
        </View>

        <Text style={{ color: '#111827', marginTop: 2 }}>{c.body}</Text>

        {Object.entries(summary).filter(([, v]) => Number(v) > 0).length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
            {Object.entries(summary)
              .filter(([, v]) => Number(v) > 0)
              .map(([reaction, count]) => {
                const emoji = reactionEmojis[reaction as keyof typeof reactionEmojis] ?? '';
                const qty = Number(count) || 0;
                return (
                  <View key={reaction} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 14 }}>{emoji}</Text>
                    <Text style={{ color: '#111827', fontSize: 12 }}>{qty}</Text>
                  </View>
                );
              })}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Menu
            visible={commentReactionMenu === c.id}
            onDismiss={() => setCommentReactionMenu(null)}
            anchor={
              <Button
                compact
                onPress={() => setCommentReactionMenu(c.id)}
              >
                {viewerReaction ? (reactionEmojis[viewerReaction as keyof typeof reactionEmojis] || '') : 'React'}
              </Button>
            }
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4, gap: 10 }}>
              {Object.keys(reactionEmojis).map((key) => (
                <TouchableOpacity
                  key={key}
                  onPress={async () => {
                    setCommentReactionMenu(null);
                    try {
                      await reactToHubComment(commentPostId, c.id, key as HubReactionType);
                      onRefresh();
                    } catch {
                      setCommentError('Failed to react');
                    }
                  }}
                  style={{ padding: 6 }}
                >
                  <Text style={{ fontSize: 16 }}>{reactionEmojis[key as keyof typeof reactionEmojis] || ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {viewerReaction ? (
              <Menu.Item
                onPress={() =>
                  removeHubCommentReaction(commentPostId, c.id)
                    .then(onRefresh)
                    .catch(() => setCommentError('Failed to remove reaction'))
                }
                title="Remove reaction"
              />
            ) : null}
          </Menu>
          <Button compact onPress={() => { setReplyToId(c.id); setEditingCommentId(null); }}>
            Reply
          </Button>
          {c.can_edit || c.is_admin ? (
            <Button
              compact
              onPress={() => {
                setCommentDraft(c.body);
                setEditingCommentId(c.id);
              }}
            >
              Edit
            </Button>
          ) : null}
          {c.can_edit || c.is_admin ? (
            <Button
              compact
              textColor="#DC2626"
              onPress={async () => {
                try {
                  await deleteHubComment(c.post, c.id);
                  setComments((prev) => prev.filter((item) => item.id !== c.id));
                  onRefresh();
                } catch {
                  setCommentError('Failed to delete comment');
                }
              }}
            >
              Delete
            </Button>
          ) : null}
        </View>

        {c.replies?.length ? (
          <View style={{ marginTop: 4, gap: 6 }}>
            {c.replies.map((child: any) => renderCommentNode(child, depth + 1))}
          </View>
        ) : null}
        {isReplyingHere ? (
          <View style={{ marginTop: 8, gap: 6, marginLeft: 6 }}>
            <TextInput
              mode="outlined"
              label="Reply"
              placeholder="Reply to comment"
              value={commentDraft}
              onChangeText={setCommentDraft}
              multiline
            />
            {commentError ? <HelperText type="error">{commentError}</HelperText> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                mode="contained"
                onPress={async () => {
                  if (!commentPost || !commentDraft.trim()) return;
                  setCommentsLoading(true);
                  try {
                    const payload = { body: commentDraft.trim(), parentComment: c.id } as any;
                    const created = await createHubComment(commentPost.id, payload);
                    setComments((prev) => [...prev, created]);
                    setCommentDraft('');
                    setReplyToId(null);
                    onRefresh();
                  } catch {
                    setCommentError('Failed to add reply');
                  } finally {
                    setCommentsLoading(false);
                  }
                }}
              >
                Post reply
              </Button>
              <Button
                mode="text"
                onPress={() => {
                  setReplyToId(null);
                  setCommentDraft('');
                  setCommentError(null);
                }}
              >
                Cancel
              </Button>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const load = useCallback(
    async (url?: string, append = false) => {
      if (!stableScope) return;
      if (url && url === next && append === false) return;
      setLoading(true);
      try {
        // If a next URL is provided, use it; otherwise fetch for the current scope (include attachments)
        const data: any = url
          ? await fetchHubPosts(url as any)
          : await fetchHubPosts({ ...(stableScope as any), includeAttachments: true });
        const list = Array.isArray(data?.posts)
          ? data.posts
          : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data)
              ? data
              : [];
        setPosts((prev) => (append ? [...prev, ...list] : list));
        setNext((data as any)?.next ?? null);
      } catch (err) {
        // swallow for now
      } finally {
        setLoading(false);
      }
    },
    [stableScope, next],
  );

  useEffect(() => {
    setPosts([]);
    setNext(null);
    void load();
    setPolls([]);
    setPollsError(null);
    setPollsLoading(true);
    fetchHubPolls(stableScope as any)
      .then((data: any) => {
        const list = Array.isArray(data) ? data : Array.isArray((data as any)?.results) ? (data as any).results : [];
        setPolls(list);
      })
      .catch(() => setPollsError('Failed to load polls'))
      .finally(() => setPollsLoading(false));
  }, [scope, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(undefined, false);
      setPollsLoading(true);
      const data: any = await fetchHubPolls(stableScope as any);
      const list = Array.isArray(data) ? data : Array.isArray((data as any)?.results) ? (data as any).results : [];
      setPolls(list);
    } catch {
      setPollsError('Failed to load polls');
    } finally {
      setPollsLoading(false);
      setRefreshing(false);
    }
  }, [load, stableScope]);

  const renderFooter = () => {
    if (!next) return null;
    return (
      <Button onPress={() => load(next, true)} mode="text" style={{ marginVertical: 8 }}>
        Load more
      </Button>
    );
  };

  if (!scopeValid) {
    return (
      <View style={{ padding: 16 }}>
        <Text>Select a pharmacy or organization to see posts.</Text>
      </View>
    );
  }

  const listHeader = () => (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: header ? 0 : 12, paddingBottom: 8, alignItems: 'center' }}>
      <Button icon="pencil" mode="contained" onPress={() => { setEditing(null); setComposerVisible(true); }}>
        New post
      </Button>
      <Button
        icon="poll"
        mode="contained-tonal"
        onPress={() => {
          setEditingPoll(null);
          setPollVisible(true);
        }}
      >
        New poll
      </Button>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {header ? (
        <Animated.View style={[feedStyles.headerContainer, { height: headerHeight }]}>
          {header.cover ? <Image source={{ uri: header.cover }} style={feedStyles.headerImage} /> : null}
          <View style={feedStyles.headerTopRow}>
            {onBack ? (
              <IconButton
                icon="arrow-left"
                mode="contained-tonal"
                size={22}
                onPress={onBack}
                style={{ margin: 0 }}
              />
            ) : null}
            {header.canEditProfile && header.onEditProfile ? (
              <Animated.View style={{ opacity: heroOpacity }}>
                <Menu
                  visible={profileMenuVisible}
                  onDismiss={() => setProfileMenuVisible(false)}
                  anchor={
                    <IconButton
                      icon="dots-vertical"
                      mode="contained-tonal"
                      size={20}
                      onPress={() => setProfileMenuVisible(true)}
                    />
                  }
                >
                  <Menu.Item
                    onPress={() => {
                      setProfileMenuVisible(false);
                      header.onEditProfile?.();
                    }}
                    title="Edit profile"
                    leadingIcon="pencil"
                  />
                </Menu>
              </Animated.View>
            ) : null}
          </View>
          <Animated.View style={[feedStyles.heroOverlay, { opacity: heroOpacity }]}>
            <Text style={feedStyles.heroTitle}>{header.title}</Text>
            {header.subtitle ? <Text style={feedStyles.heroSubtitle}>{header.subtitle}</Text> : null}
          </Animated.View>
          <Animated.View style={[feedStyles.barTitleContainer, { opacity: barOpacity }]}>
            <Text numberOfLines={1} style={feedStyles.barTitle}>{header.title}</Text>
          </Animated.View>
        </Animated.View>
      ) : null}

      <Animated.FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onEdit={(p) => { setEditing(p); setComposerVisible(true); }}
            onComment={() => {
              setCommentPost(item);
              setComments([]);
              setCommentDraft('');
              setCommentError(null);
              setCommentsLoading(true);
              fetchHubComments(item.id)
                .then((data: any) => {
                  const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
                  const withPost = list.map((c: any) => ({ ...c, post: c.post || c.postId || item.id }));
                  setComments(withPost);
                })
                .catch(() => setCommentError('Failed to load comments'))
                .finally(() => setCommentsLoading(false));
            }}
            onRefresh={onRefresh}
          />
        )}
        ListHeaderComponent={
          <>
            {listHeader()}
            {pollsLoading ? (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <ActivityIndicator />
              </View>
            ) : pollsError ? (
              <HelperText type="error">{pollsError}</HelperText>
            ) : polls.length ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
                {polls.map((poll) => (
                  <View key={poll.id} style={pollStyles.card}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <Text style={pollStyles.question}>{poll.question}</Text>
                      {poll.canManage ? (
                        <Menu
                          visible={pollMenuId === poll.id}
                          onDismiss={() => setPollMenuId(null)}
                          anchor={
                            <IconButton
                              icon="dots-vertical"
                              size={20}
                              onPress={() => setPollMenuId((prev) => (prev === poll.id ? null : poll.id))}
                            />
                          }
                        >
                          <Menu.Item
                            onPress={() => {
                              setPollMenuId(null);
                              setEditingPoll(poll);
                              setPollVisible(true);
                            }}
                            title="Edit"
                          />
                          <Menu.Item
                            onPress={() => {
                              setPollMenuId(null);
                              Alert.alert('Delete poll', 'Are you sure you want to delete this poll?', [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Delete',
                                  style: 'destructive',
                                  onPress: async () => {
                                    try {
                                      await deleteHubPoll(poll.id);
                                      setPolls((prev) => prev.filter((p) => p.id !== poll.id));
                                    } catch {
                                      setPollError('Failed to delete poll');
                                    }
                                  },
                                },
                              ]);
                            }}
                            title="Delete"
                          />
                        </Menu>
                      ) : null}
                    </View>
                    {poll.options
                      .slice()
                      .sort((a, b) => a.position - b.position)
                      .map((opt) => {
                        const isSelected = poll.selectedOptionId === opt.id;
                        return (
                          <TouchableOpacity
                            key={opt.id}
                            style={[pollStyles.option, isSelected ? pollStyles.optionSelected : null]}
                            disabled={!poll.canVote}
                            onPress={async () => {
                              if (!poll.canVote) return;
                              try {
                                setPolls((prev) =>
                                  prev.map((p) =>
                                    p.id === poll.id ? { ...p, selectedOptionId: opt.id, hasVoted: true } : p,
                                  ),
                                );
                                const updated = await voteHubPoll(poll.id, opt.id);
                                setPolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                              } catch {
                                setPollsError('Failed to vote');
                              }
                            }}
                          >
                            <Text style={pollStyles.optionLabel}>{opt.label}</Text>
                            <Text style={pollStyles.optionMeta}>{opt.percentage ?? 0}% â€¢ {opt.voteCount} votes</Text>
                          </TouchableOpacity>
                        );
                      })}
                    {poll.hasVoted ? <Chip compact style={{ alignSelf: 'flex-start', marginTop: 6 }}>You voted</Chip> : null}
                  </View>
                ))}
                {pollError ? <HelperText type="error">{pollError}</HelperText> : null}
              </View>
            ) : null}
          </>
        }
        ListFooterComponent={renderFooter}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={{ padding: 16 }}>
              <Text style={{ color: '#6B7280' }}>No posts yet.</Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingTop: header ? HEADER_EXPANDED + 16 : 8, paddingBottom: 24 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      />

      <PostComposer
        visible={composerVisible}
        onDismiss={() => { setComposerVisible(false); setEditing(null); }}
        scope={scope}
        onSaved={onRefresh}
        editing={editing || undefined}
      />
      <PollComposer
        visible={pollVisible}
        onDismiss={() => {
          setPollVisible(false);
          setEditingPoll(null);
        }}
        scope={scope}
        onSaved={onRefresh}
        editing={editingPoll || undefined}
      />

      <Portal>
        <Modal
          visible={!!commentPost}
          onDismiss={() => {
            setCommentPost(null);
            setComments([]);
            setCommentDraft('');
            setCommentError(null);
            setEditingCommentId(null);
            setReplyToId(null);
          }}
          contentContainerStyle={commentModalStyles.container}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text variant="titleMedium">Comments</Text>
            <IconButton icon="close" onPress={() => { setCommentPost(null); setComments([]); setCommentDraft(''); setCommentError(null); }} />
          </View>
          <ScrollView style={commentModalStyles.list} contentContainerStyle={{ paddingBottom: 12 }}>
            {commentsLoading ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator />
              </View>
            ) : comments.length ? (
              <View style={{ gap: 8 }}>
                {buildCommentTree(comments).map((node) => renderCommentNode(node, 0))}
              </View>
            ) : (
              <Text style={{ color: '#6B7280', marginVertical: 8 }}>No comments yet.</Text>
            )}
          </ScrollView>
        <Divider style={{ marginVertical: 8 }} />
        {!replyToId ? (
          <View style={{ gap: 8 }}>
            <TextInput
              mode="outlined"
              label={replyToId ? 'Reply' : 'Add a comment'}
              placeholder={editingCommentId ? 'Edit your comment' : replyToId ? 'Reply to comment' : 'Add a comment'}
              value={commentDraft}
              onChangeText={setCommentDraft}
              multiline
              style={{ marginBottom: 4 }}
            />
            {commentError ? <HelperText type="error">{commentError}</HelperText> : null}
            <Button
              mode="contained"
              onPress={async () => {
                if (!commentPost || !commentDraft.trim()) return;
                setCommentsLoading(true);
                try {
                  const payload = { body: commentDraft.trim(), parentComment: replyToId || null } as any;
                  let created: any;
                  if (editingCommentId) {
                    created = await updateHubComment(commentPost.id, editingCommentId, payload);
                    setComments((prev) => prev.map((c) => (c.id === editingCommentId ? created : c)));
                  } else {
                created = await createHubComment(commentPost.id, payload);
                setComments((prev) => [...prev, { ...created, post: commentPost.id }]);
                  }
                  setCommentDraft('');
                  setEditingCommentId(null);
                  setReplyToId(null);
                  onRefresh();
                } catch {
                  setCommentError('Failed to add comment');
                } finally {
                  setCommentsLoading(false);
                }
              }}
            >
              Post comment
            </Button>
          </View>
        ) : null}
        </Modal>
      </Portal>
    </View>
  );
}

const feedStyles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    backgroundColor: '#111827',
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerImage: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  headerTopRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    gap: 6,
  },
  heroTitle: { color: 'white', fontSize: 22, fontWeight: '800' },
  heroSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14 },
  barTitleContainer: {
    position: 'absolute',
    bottom: 10,
    left: 16,
    right: 16,
  },
  barTitle: { color: 'white', fontWeight: '700', fontSize: 16 },
});

const pollStyles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  question: { fontWeight: '700', color: '#111827', marginBottom: 8 },
  option: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    backgroundColor: '#F9FAFB',
  },
  optionSelected: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  optionLabel: { fontWeight: '600', color: '#111827' },
  optionMeta: { color: '#6B7280', marginTop: 2, fontSize: 12 },
});

const commentModalStyles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    maxHeight: '85%',
    minHeight: 260,
  },
  list: { maxHeight: '65%' },
});
