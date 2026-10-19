import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Txt } from '@/components/ui';
import { space, useTheme } from '@/theme';

/** One row in the account menu: icon, title, one-line description, chevron. */
export function MenuLink({
  icon: Icon,
  title,
  sub,
  onPress,
  badge,
  last,
  danger,
}: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  onPress: () => void;
  badge?: string;
  last?: boolean;
  danger?: boolean;
}) {
  const { c } = useTheme();
  const tint = danger ? c.danger : c.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={sub}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
        opacity: pressed ? 0.6 : 1,
      })}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: danger ? 'transparent' : c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="label" color={danger ? c.danger : undefined}>
          {title}
        </Txt>
        {sub ? <Txt v="faint">{sub}</Txt> : null}
      </View>
      {badge ? (
        <View style={{ backgroundColor: c.primary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Txt style={{ color: c.primaryText, fontSize: 12, fontWeight: '700' }}>{badge}</Txt>
        </View>
      ) : null}
      {danger ? null : <ChevronRight size={18} color={c.textFaint} />}
    </Pressable>
  );
}
