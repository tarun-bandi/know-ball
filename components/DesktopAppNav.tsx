import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Bell, Compass, Home, Search, User } from "lucide-react-native";
import { stadiumSlate } from "@/lib/theme";

const NAV_ITEMS = [
  { label: "Feed", href: "/(tabs)/feed", match: "/feed", icon: Home },
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
        paddingHorizontal: 24,
        paddingTop: 18,
        paddingBottom: 12,
      }}
    >
      <View
        style={{
          minHeight: 56,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "rgba(70,96,121,0.55)",
          backgroundColor: "rgba(17,25,35,0.9)",
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 18px 40px rgba(0,0,0,0.24)",
        } as any}
      >
        <Pressable
          onPress={() => router.push("/(tabs)/feed")}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: stadiumSlate.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: stadiumSlate.background, fontWeight: "900", fontSize: 14 }}>KB</Text>
          </View>
          <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "800" }}>
            Know Ball
          </Text>
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname?.includes(item.match);
            return (
              <Pressable
                key={item.href}
                onPress={() => router.push(item.href as any)}
                style={({ hovered, pressed }: any) => ({
                  height: 36,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: active
                    ? "rgba(78,161,255,0.16)"
                    : hovered || pressed
                      ? "rgba(255,255,255,0.06)"
                      : "transparent",
                })}
              >
                <Icon
                  size={16}
                  color={active ? "#4ea1ff" : "#8fa1b3"}
                  strokeWidth={2.2}
                />
                <Text
                  style={{
                    color: active ? "#d9ecff" : "#a7b6c8",
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
            width: 36,
            height: 36,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: hovered || pressed ? "rgba(255,255,255,0.06)" : "transparent",
          })}
        >
          <Bell size={17} color={stadiumSlate.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}
