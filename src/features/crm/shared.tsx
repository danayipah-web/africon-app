import { router, usePathname } from 'expo-router';
import { create } from 'zustand';

import { Tabs } from '@/components/layout';
import type { Campaign, ConditionGroup } from '@/domain/types';

/** Contacts | Segments | Campaigns section tabs (spec §6). */
export function CrmTabs() {
  const path = usePathname();
  const value = path.startsWith('/crm/segments') ? 'segments' : path.startsWith('/crm/campaigns') ? 'campaigns' : 'contacts';
  return (
    <Tabs
      tabs={[
        { value: 'contacts', label: 'Contacts' },
        { value: 'segments', label: 'Segments' },
        { value: 'campaigns', label: 'Campaigns' },
      ]}
      value={value}
      onChange={(v) => router.navigate(v === 'contacts' ? '/crm' : `/crm/${v}`)}
    />
  );
}

/** Hand-off from a list selection / filter to the campaign composer. */
export interface CampaignPrefill {
  channel?: Campaign['channel'];
  contactIds?: string[];
  conditions?: ConditionGroup | null;
  segmentIds?: string[];
}
export const useCampaignPrefill = create<{ prefill: CampaignPrefill | null; set: (p: CampaignPrefill | null) => void }>((set) => ({
  prefill: null,
  set: (prefill) => set({ prefill }),
}));

export function openCampaign(p: CampaignPrefill) {
  useCampaignPrefill.getState().set(p);
  router.push('/crm/campaigns');
}
