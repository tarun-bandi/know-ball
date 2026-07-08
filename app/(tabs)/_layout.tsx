import { View, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Home, Compass, Search, User, Bell } from 'lucide-react-native';

export default function TabsLayout() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 900;

  return (
    <Tabs
      screenOptions={{
        headerShown: !isDesktopWeb,
        tabBarStyle: {
          backgroundColor: '#111923',
          borderTopColor: '#2f4052',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          paddingTop: 1,
          display: isDesktopWeb ? 'none' : 'flex',
        },
        tabBarBackground: () => (
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#111923',
          }}>
            {/* Active accent line at top */}
            <View style={{
              height: 0.5,
              backgroundColor: '#4ea1ff',
              opacity: 0.2,
            }} />
          </View>
        ),
        tabBarActiveTintColor: '#4ea1ff',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.5,
        },
        headerStyle: {
          backgroundColor: '#111923',
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
              <Bell size={22} color="#8fa1b3" />
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
