import { View, TouchableOpacity, Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Home, Compass, Search, User, Bell } from 'lucide-react-native';

export default function TabsLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#141416',
          borderTopColor: '#2a2a30',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          paddingTop: 1,
        },
        tabBarBackground: () => (
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#141416',
          }}>
            {/* Gold accent line at top */}
            <View style={{
              height: 0.5,
              backgroundColor: '#d4a843',
              opacity: 0.2,
            }} />
          </View>
        ),
        tabBarActiveTintColor: '#d4a843',
        tabBarInactiveTintColor: '#4a4a55',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.5,
        },
        headerStyle: {
          backgroundColor: '#141416',
          ...(Platform.OS === 'web' ? {} : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }),
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarTestID: 'tab_feed',
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size - 1} strokeWidth={2.2} />
          ),
          headerRight: () => (
            <TouchableOpacity
              testID="notifications_bell"
              onPress={() => router.push('/notifications')}
              style={{ marginRight: 16 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Bell size={22} color="#7a7d88" />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarTestID: 'tab_discover',
          tabBarIcon: ({ color, size }) => (
            <Compass color={color} size={size - 1} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarTestID: 'tab_search',
          tabBarIcon: ({ color, size }) => (
            <Search color={color} size={size - 1} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarTestID: 'tab_profile',
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size - 1} strokeWidth={2.2} />
          ),
        }}
      />
    </Tabs>
  );
}
