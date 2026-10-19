import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { SearchInput } from '@/components/form';
import { ListRow, Screen } from '@/components/layout';
import { EmptyState, Pill, Row, Txt } from '@/components/ui';
import { useDb } from '@/data/db';
import { firstDate } from '@/domain/defaults';
import { shortDate } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/rbac';

/** Global search across events, bookings, contacts and users (Ctrl/Cmd+K on the web admin). */
export default function GlobalSearch() {
  const [q, setQ] = useState('');
  const events = useDb((s) => s.events);
  const bookings = useDb((s) => s.bookings);
  const contacts = useDb((s) => s.contacts);
  const users = useDb((s) => s.users);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const has = (...xs: string[]) => xs.some((x) => x.toLowerCase().includes(s));
    return [
      ...events.filter((e) => has(e.title, e.category, e.slug)).slice(0, 5).map((e) => ({ key: `e${e.id}`, kind: 'Event', title: e.title, sub: shortDate(firstDate(e)), href: `/events/${e.id}` })),
      ...bookings.filter((b) => has(b.ref, b.customer.fullName, b.customer.email)).slice(0, 6).map((b) => ({ key: `b${b.id}`, kind: 'Booking', title: `${b.ref} · ${b.customer.fullName}`, sub: b.customer.email, href: `/bookings/${b.id}` })),
      ...contacts.filter((c) => has(c.fullName, c.email, c.phone, c.company)).slice(0, 6).map((c) => ({ key: `c${c.id}`, kind: 'Contact', title: c.fullName || c.email || c.phone, sub: c.email || c.phone, href: `/crm/${c.id}` })),
      ...users.filter((u) => has(u.displayName, u.email)).slice(0, 4).map((u) => ({ key: `u${u.id}`, kind: 'User', title: u.displayName, sub: `${u.email} · ${ROLE_LABELS[u.role]}`, href: `/users/${u.id}` })),
    ];
  }, [q, events, bookings, contacts, users]);

  return (
    <Screen>
      <SearchInput value={q} onChange={setQ} placeholder="Search events, bookings, contacts, users" />
      {q.trim().length < 2 ? (
        <EmptyState title="Search everything" body="Type at least two characters: a name, email, booking ref or event title." />
      ) : results.length === 0 ? (
        <EmptyState title="No matches" body="Try a different spelling, or search by email." />
      ) : (
        <View style={{ gap: 8 }}>
          {results.map((r) => (
            <ListRow key={r.key} onPress={() => router.push(r.href as never)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="label" style={{ flex: 1 }} numberOfLines={1}>
                  {r.title}
                </Txt>
                <Pill label={r.kind} />
              </Row>
              <Txt v="faint">{r.sub}</Txt>
            </ListRow>
          ))}
        </View>
      )}
    </Screen>
  );
}
