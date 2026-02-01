import { useMemo } from "react";
import { Candidate } from "../types";
import { TalentFilterState } from "../components/FiltersSidebar";

export const useTalentFilters = (candidates: Candidate[], filters: TalentFilterState) => {
  const roleOptions = useMemo(() => {
    const unique = new Set<string>();
    candidates.forEach((c) => {
      if (c.role) unique.add(c.role);
    });
    return Array.from(unique).sort();
  }, [candidates]);

  const stateOptions = useMemo(() => {
    const unique = new Set<string>();
    candidates.forEach((c) => {
      if (c.state) unique.add(c.state);
    });
    return Array.from(unique).sort();
  }, [candidates]);

  const roleSkillOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    candidates.forEach((c) => {
      if (!map[c.role]) map[c.role] = [];
      const roleSkills = (c.skills ?? []).filter((skill: string) => !c.software.includes(skill));
      map[c.role].push(...roleSkills);
    });
    Object.keys(map).forEach((role) => {
      map[role] = Array.from(new Set(map[role])).sort();
    });
    return map;
  }, [candidates]);

  const softwareOptions = useMemo(() => {
    const unique = new Set<string>();
    candidates.forEach((c) => c.software.forEach((s: string) => unique.add(s)));
    return Array.from(unique).sort();
  }, [candidates]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (search) {
        const haystack = `${c.role} ${c.pitch} ${c.city} ${c.refId}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (filters.roles.length > 0 && !filters.roles.includes(c.role)) return false;
      if (filters.workTypes.length > 0) {
        const hasMatch = c.workTypes.some((type: string) => filters.workTypes.includes(type));
        if (!hasMatch) return false;
      }
      if (filters.states.length > 0 && !filters.states.includes(c.state)) return false;
      if (filters.skills.length > 0) {
        const hasAllSkills = filters.skills.every((skill: string) => c.skills.includes(skill));
        if (!hasAllSkills) return false;
      }
      if (filters.willingToTravel && !c.willingToTravel) return false;
      if (filters.placementSeeker && !c.isInternshipSeeker) return false;
      return true;
    });
  }, [candidates, filters]);

  return {
    filtered,
    roleOptions,
    stateOptions,
    roleSkillOptions,
    softwareOptions,
  };
};
