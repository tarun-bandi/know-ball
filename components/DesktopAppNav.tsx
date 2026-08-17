import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Bell, Compass, Home, Search, Trophy, User } from "lucide-react-native";
import { stadiumSlate } from "@/lib/theme";

const NAV_ITEMS = [
  { label: "Feed", href: "/(tabs)/feed", match: "/feed", icon: Home },
  { label: "World Cup", href: "/world-cup", match: "/world-cup", icon: Trophy },
  { label: "Discover", href: "/(tabs)/discover", match: "/discover", icon: Compass },
  { label: "Search", href: "/(tabs)/search", match: "/search", icon: Search },
  { label: "Profile", href: "/(tabs)/profile", match: "/profile", icon: User },
];

export default function DesktopAppNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 900;

  if (!isDesktop) return null;

  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 14,
      }}
    >
      <View
        style={{
          minHeight: 68,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.09)",
          backgroundColor: "rgba(13,17,23,0.88)",
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04)",
        } as any}
      >
        <Pressable
          onPress={() => router.push("/(tabs)/feed")}
          style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 4 }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: stadiumSlate.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: stadiumSlate.background, fontWeight: "900", fontSize: 13, letterSpacing: -0.5 }}>KB</Text>
          </View>
          <View>
            <Text style={{ color: stadiumSlate.text, fontSize: 16, fontWeight: "900", letterSpacing: -0.4 }}>
              KNOW BALL
            </Text>
            <Text style={{ color: stadiumSlate.textSubtle, fontSize: 9, fontWeight: "800", letterSpacing: 1.6, marginTop: 1 }}>
              BASKETBALL SOCIAL
            </Text>
          </View>
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname?.includes(item.match);
            return (
              <Pressable
                key={item.href}
                onPress={() => router.push(item.href as any)}
                style={({ hovered, pressed }: any) => ({
                  height: 40,
                  borderRadius: 12,
                  paddingHorizontal: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: active
                    ? "rgba(255,106,61,0.13)"
                    : hovered || pressed
                      ? "rgba(255,255,255,0.06)"
                      : "transparent",
                })}
              >
                <Icon
                  size={16}
                  color={active ? stadiumSlate.accent : stadiumSlate.textMuted}
                  strokeWidth={2.2}
                />
                <Text
                  style={{
                    color: active ? stadiumSlate.text : stadiumSlate.textMuted,
                    fontSize: 13,
                    fontWeight: active ? "800" : "600",
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => router.push("/notifications")}
          style={({ hovered, pressed }: any) => ({
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            backgroundColor: hovered || pressed ? "rgba(255,106,61,0.10)" : "rgba(255,255,255,0.025)",
          })}
        >
          <Bell size={17} color={stadiumSlate.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}
