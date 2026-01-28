import { useMemo } from 'react';
import { ExplorerPost } from '@chemisttasker/shared-core';
import { TalentFilterConfig } from '../types';

const getRoleLabel = (post: ExplorerPost) =>
  post.roleTitle || post.explorerRoleType || post.roleCategory || 'Explorer';

const getStateLabel = (post: ExplorerPost) =>
  post.locationState || '';

const getEngagement = (post: ExplorerPost) => post.workType || '';

export const useTalentFilters = (posts: ExplorerPost[], filters: TalentFilterConfig) => {
  const roleOptions = useMemo(() => {
    const unique = new Set<string>();
    posts.forEach((post) => {
      const role = getRoleLabel(post);
      if (role) unique.add(role);
    });
    return Array.from(unique).sort();
  }, [posts]);

  const stateOptions = useMemo(() => {
    const unique = new Set<string>();
    posts.forEach((post) => {
      const state = getStateLabel(post);
      if (state) unique.add(state);
    });
    return Array.from(unique).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return posts.filter((post) => {
      const role = getRoleLabel(post);
      const state = getStateLabel(post);
      const engagement = getEngagement(post);
      if (search) {
        const haystack = `${role} ${post.headline ?? ''} ${post.body ?? ''}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (filters.roles.length > 0 && !filters.roles.includes(role)) return false;
      if (filters.states.length > 0 && !filters.states.includes(state)) return false;
      if (filters.engagementTypes.length > 0 && !filters.engagementTypes.includes(engagement as any)) return false;
      return true;
    });
  }, [posts, filters]);

  return { filtered, roleOptions, stateOptions };
};
