import { useCallback, useEffect, useState } from 'react';
import { getExplorerPostFeed, ExplorerPost } from '@chemisttasker/shared-core';

const mapPost = (post: any): ExplorerPost => ({
  ...post,
  authorUserId: post.author_user_id ?? post.authorUserId ?? null,
  roleTitle: post.role_title ?? post.roleTitle ?? null,
  workType: post.work_type ?? post.workType ?? null,
  locationState: post.location_state ?? post.locationState ?? null,
  locationSuburb: post.location_suburb ?? post.locationSuburb ?? null,
  locationPostcode: post.location_postcode ?? post.locationPostcode ?? null,
  referenceCode: post.reference_code ?? post.referenceCode ?? null,
  isAnonymous: post.is_anonymous ?? post.isAnonymous ?? null,
  explorerRoleType: post.explorer_role_type ?? post.explorerRoleType ?? null,
  explorerUserId: post.explorer_user_id ?? post.explorerUserId ?? null,
});

export const useTalentFeed = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<ExplorerPost[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await getExplorerPostFeed({ page: 1, page_size: 200 });
      if (Array.isArray(res)) {
        const mapped = res.map(mapPost);
        setPosts(mapped);
        setTotalCount(mapped.length);
      } else if (res && Array.isArray(res.results)) {
        const mapped = res.results.map(mapPost);
        setPosts(mapped);
        setTotalCount(typeof res.count === 'number' ? res.count : mapped.length);
      } else {
        setPosts([]);
        setTotalCount(0);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load talent feed.');
      setPosts([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { posts, totalCount, loading, error, reload: load };
};
