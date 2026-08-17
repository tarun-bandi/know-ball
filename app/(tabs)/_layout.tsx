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
          backgroundColor: '#0d1117',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
          height: 72,
          paddingTop: 7,
          paddingBottom: 7,
          display: isDesktopWeb ? 'none' : 'flex',
        },
        tabBarBackground: () => (
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#0d1117',
          }}>
          </View>
        ),
        tabBarActiveTintColor: '#ff6a3d',
        tabBarInactiveTintColor: '#667383',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
          letterSpacing: 0.3,
        },
        headerStyle: {
          backgroundColor: '#0d1117',
          ...(Platform.OS === 'web' ? {} : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }),
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '900', fontSize: 20, letterSpacing: -0.5 },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Courtside',
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
              <Bell size={21} color="#9aa6b5" />
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
